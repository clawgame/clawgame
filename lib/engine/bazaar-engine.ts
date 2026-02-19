import { prisma } from '@/lib/prisma';
import { MatchStatus, MessageType, ArenaType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { makeTradeDecision, type TradeContext, type GoodInfo, type TradeDecision } from './agent-ai';
import type { CustomStrategyConfig } from './custom-strategy';
import { createMatchMarkets, updateMarketOdds, settleMarkets, type MatchResult } from './market-manager';
import { updateMatchStats } from './stats-updater';
import { emitMatchEvent } from './ws-emitter';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchEngineConfig {
  matchId: string;
  agent1Id: string;
  agent2Id: string;
  maxRounds: number;
  prizePool: number;
  roundDelayMs?: number;
  messageDelayMs?: number;
}

interface LoadedAgent {
  id: string;
  name: string;
  strategy: 'AGGRESSIVE' | 'DEFENSIVE' | 'BALANCED' | 'CHAOTIC' | 'CUSTOM';
  strategyConfig: CustomStrategyConfig | null;
  rating: number;
  wins: number;
  losses: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GOODS: { name: string; totalSupply: number }[] = [
  { name: 'Gold', totalSupply: 10 },
  { name: 'Silver', totalSupply: 10 },
  { name: 'Spice', totalSupply: 10 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generatePrivateValues(): number[] {
  // Each good has a random per-unit value between 1 and 10
  return GOODS.map(() => Math.round(rand(1, 10)));
}

function buildGoodsInfo(privateValues: number[]): GoodInfo[] {
  return GOODS.map((g, i) => ({
    name: g.name,
    totalSupply: g.totalSupply,
    myValue: privateValues[i],
  }));
}

function formatAllocation(alloc: Record<string, number>): string {
  return GOODS.map(g => `${alloc[g.name] ?? 0} ${g.name}`).join(', ');
}

function invertAllocation(alloc: Record<string, number>): Record<string, number> {
  const inv: Record<string, number> = {};
  for (const good of GOODS) {
    inv[good.name] = good.totalSupply - (alloc[good.name] ?? 0);
  }
  return inv;
}

function calculateValue(alloc: Record<string, number>, values: number[]): number {
  let total = 0;
  GOODS.forEach((g, i) => {
    total += (alloc[g.name] ?? 0) * values[i];
  });
  return total;
}

function maxPossibleValue(values: number[]): number {
  let total = 0;
  GOODS.forEach((g, i) => { total += g.totalSupply * values[i]; });
  return total;
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

export async function runBazaarMatch(config: MatchEngineConfig): Promise<MatchResult> {
  const {
    matchId,
    agent1Id,
    agent2Id,
    maxRounds,
    prizePool,
    roundDelayMs = 2000,
    messageDelayMs = 1000,
  } = config;

  try {
    // Load agents
    const [agent1Data, agent2Data] = await Promise.all([
      prisma.agent.findUniqueOrThrow({ where: { id: agent1Id } }),
      prisma.agent.findUniqueOrThrow({ where: { id: agent2Id } }),
    ]);

    const agent1: LoadedAgent = {
      id: agent1Data.id, name: agent1Data.name, strategy: agent1Data.strategy,
      strategyConfig: agent1Data.strategyConfig as CustomStrategyConfig | null,
      rating: agent1Data.rating, wins: agent1Data.wins, losses: agent1Data.losses,
    };
    const agent2: LoadedAgent = {
      id: agent2Data.id, name: agent2Data.name, strategy: agent2Data.strategy,
      strategyConfig: agent2Data.strategyConfig as CustomStrategyConfig | null,
      rating: agent2Data.rating, wins: agent2Data.wins, losses: agent2Data.losses,
    };

    // Generate private values (hidden from each other)
    const agent1Values = generatePrivateValues();
    const agent2Values = generatePrivateValues();

    // Transition to LIVE
    await prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.LIVE, startedAt: new Date(), round: 0 },
    });

    await prisma.globalStats.upsert({
      where: { id: 'global' },
      create: { id: 'global', liveMatches: 1 },
      update: { liveMatches: { increment: 1 } },
    });

    await emitMatchEvent(matchId, 'match_start', {
      matchId,
      arena: 'BAZAAR',
      agent1: { id: agent1.id, name: agent1.name, strategy: agent1.strategy },
      agent2: { id: agent2.id, name: agent2.name, strategy: agent2.strategy },
      goods: GOODS.map(g => g.name),
    });

    await createMatchMarkets(matchId, agent1Data, agent2Data, ArenaType.BAZAAR);

    // Determine first mover
    const ratingDiff = agent1.rating - agent2.rating;
    const firstMoverIsAgent1 = ratingDiff + (Math.random() * 100 - 50) > 0;

    // ─── Game Loop ───────────────────────────────────────────────────────
    let agreed = false;
    let finalAllocAgent1: Record<string, number> | null = null;
    let lastOfferByAgent1: Record<string, number> | null = null; // what agent1 wants for themselves
    let lastOfferByAgent2: Record<string, number> | null = null; // what agent2 wants for themselves
    const agent1OfferHistory: Record<string, number>[] = [];
    const agent2OfferHistory: Record<string, number>[] = [];
    let totalRounds = 0;
    let acceptedBy: string | null = null;

    for (let round = 1; round <= maxRounds; round++) {
      totalRounds = round;

      await prisma.match.update({
        where: { id: matchId },
        data: { round },
      });

      await emitMatchEvent(matchId, 'round', {
        round,
        maxRounds,
        goods: GOODS.map(g => g.name),
      });

      const agent1Active = (round % 2 === 1) === firstMoverIsAgent1;
      const activeAgent = agent1Active ? agent1 : agent2;
      const passiveAgent = agent1Active ? agent2 : agent1;
      const activeValues = agent1Active ? agent1Values : agent2Values;
      const passiveValues = agent1Active ? agent2Values : agent1Values;
      const activeOfferHistory = agent1Active ? agent1OfferHistory : agent2OfferHistory;
      const passiveOfferHistory = agent1Active ? agent2OfferHistory : agent1OfferHistory;

      await insertSystemMessage(matchId, round,
        `🏪 Round ${round}. ${activeAgent.name} proposes a trade allocation.`);
      await sleep(500);

      // What was last offered TO the active agent (inverted from passive's last ask)?
      const lastPassiveAsk = agent1Active ? lastOfferByAgent2 : lastOfferByAgent1;
      const lastOfferToActive = lastPassiveAsk ? invertAllocation(lastPassiveAsk) : null;

      // Active agent makes trade decision
      const activeCtx: TradeContext = {
        myAgentId: activeAgent.id, myAgentName: activeAgent.name,
        opponentAgentName: passiveAgent.name, myStrategy: activeAgent.strategy,
        currentRound: round, maxRounds, prizePool,
        myRating: activeAgent.rating, opponentRating: passiveAgent.rating,
        goods: buildGoodsInfo(activeValues),
        lastOfferToMe: lastOfferToActive,
        myOfferHistory: activeOfferHistory,
        isMyTurn: true,
        myCustomConfig: activeAgent.strategyConfig,
      };

      const activeDecision = makeTradeDecision(activeCtx);
      await sleep(activeDecision.thinkingDelay);

      // Record and emit active agent's action
      if (activeDecision.action === 'ACCEPT' && lastOfferToActive) {
        await insertAgentMessage(matchId, activeAgent.id, round, MessageType.ACCEPT,
          activeDecision.message);

        // Active accepted what passive offered (passive's last ask)
        finalAllocAgent1 = agent1Active ? lastOfferToActive : lastPassiveAsk!;
        agreed = true;
        acceptedBy = activeAgent.id;
        await recordRound(matchId, round, null, null, true, activeAgent.id);
        break;
      }

      if (activeDecision.action === 'REJECT') {
        await insertAgentMessage(matchId, activeAgent.id, round, MessageType.REJECT,
          activeDecision.message);
      }

      if (activeDecision.allocation) {
        const allocStr = formatAllocation(activeDecision.allocation);
        const msgType = activeDecision.action === 'OFFER' ? MessageType.OFFER : MessageType.COUNTER;
        await insertAgentMessage(matchId, activeAgent.id, round, msgType,
          `${activeDecision.message} [${allocStr}]`);

        if (agent1Active) {
          lastOfferByAgent1 = activeDecision.allocation;
          agent1OfferHistory.push(activeDecision.allocation);
        } else {
          lastOfferByAgent2 = activeDecision.allocation;
          agent2OfferHistory.push(activeDecision.allocation);
        }

        // Emit allocation info
        await emitMatchEvent(matchId, 'round', {
          round, maxRounds, phase: 'offer',
          agent: activeAgent.name,
          allocation: activeDecision.allocation,
        });
      }

      // ─── Passive agent responds ──────────────────────────────────────────
      if (activeDecision.allocation) {
        await sleep(messageDelayMs);

        const offeredToPassive = invertAllocation(activeDecision.allocation);

        const passiveCtx: TradeContext = {
          myAgentId: passiveAgent.id, myAgentName: passiveAgent.name,
          opponentAgentName: activeAgent.name, myStrategy: passiveAgent.strategy,
          currentRound: round, maxRounds, prizePool,
          myRating: passiveAgent.rating, opponentRating: activeAgent.rating,
          goods: buildGoodsInfo(passiveValues),
          lastOfferToMe: offeredToPassive,
          myOfferHistory: passiveOfferHistory,
          isMyTurn: false,
          myCustomConfig: passiveAgent.strategyConfig,
        };

        const passiveDecision = makeTradeDecision(passiveCtx);
        await sleep(passiveDecision.thinkingDelay);

        if (passiveDecision.action === 'ACCEPT') {
          await insertAgentMessage(matchId, passiveAgent.id, round, MessageType.ACCEPT,
            passiveDecision.message);

          // Passive accepted active's offer
          finalAllocAgent1 = agent1Active ? activeDecision.allocation : offeredToPassive;
          agreed = true;
          acceptedBy = passiveAgent.id;
          await recordRound(matchId, round, null, null, true, passiveAgent.id);
          break;
        }

        if (passiveDecision.action === 'REJECT') {
          await insertAgentMessage(matchId, passiveAgent.id, round, MessageType.REJECT,
            passiveDecision.message);
        }

        if (passiveDecision.allocation) {
          const pAllocStr = formatAllocation(passiveDecision.allocation);
          const pMsgType = passiveDecision.action === 'COUNTER' ? MessageType.COUNTER : MessageType.OFFER;
          await insertAgentMessage(matchId, passiveAgent.id, round, pMsgType,
            `${passiveDecision.message} [${pAllocStr}]`);

          if (!agent1Active) {
            lastOfferByAgent1 = passiveDecision.allocation;
            agent1OfferHistory.push(passiveDecision.allocation);
          } else {
            lastOfferByAgent2 = passiveDecision.allocation;
            agent2OfferHistory.push(passiveDecision.allocation);
          }
        }
      }

      await recordRound(matchId, round, null, null, false, null);

      // Use round data for market odds updates
      const roundData = Array.from({ length: round }, (_, i) => ({
        round: i + 1,
        agent1Offer: null as number | null,
        agent2Offer: null as number | null,
        accepted: false,
      }));
      await updateMarketOdds(matchId, round, maxRounds, roundData, agent1Id, agent2Id);

      await sleep(roundDelayMs);
    }

    // ─── Settlement ────────────────────────────────────────────────────────
    let finalSplitAgent1: number;
    let finalSplitAgent2: number;
    let winnerId: string | null = null;

    if (agreed && finalAllocAgent1) {
      const allocAgent2 = invertAllocation(finalAllocAgent1);

      // Calculate value each agent captured from THEIR OWN perspective
      const value1 = calculateValue(finalAllocAgent1, agent1Values);
      const value2 = calculateValue(allocAgent2, agent2Values);
      const maxVal1 = maxPossibleValue(agent1Values);
      const maxVal2 = maxPossibleValue(agent2Values);

      // Split = percentage of total possible value each captured
      const pct1 = maxVal1 > 0 ? Math.round((value1 / maxVal1) * 100) : 50;
      const pct2 = maxVal2 > 0 ? Math.round((value2 / maxVal2) * 100) : 50;

      // Normalize so splits sum to 100 (for the prize pool distribution)
      const total = pct1 + pct2;
      finalSplitAgent1 = total > 0 ? Math.round((pct1 / total) * 100) : 50;
      finalSplitAgent2 = 100 - finalSplitAgent1;

      winnerId = finalSplitAgent1 > 50 ? agent1Id : finalSplitAgent2 > 50 ? agent2Id : null;

      await insertSystemMessage(matchId, totalRounds,
        `🏪 Deal struck! ${agent1.name}: ${formatAllocation(finalAllocAgent1)} | ${agent2.name}: ${formatAllocation(allocAgent2)}`);
      await sleep(500);
      await insertSystemMessage(matchId, totalRounds,
        `🏪 Value captured: ${agent1.name} ${pct1}% | ${agent2.name} ${pct2}%. Prize split: ${finalSplitAgent1}/${finalSplitAgent2}.`);
    } else {
      finalSplitAgent1 = 0;
      finalSplitAgent2 = 0;
      await insertSystemMessage(matchId, totalRounds,
        `🏪 No deal! After ${maxRounds} rounds of trading, both agents walk away empty-handed.`);
    }

    const result: MatchResult = {
      winnerId,
      finalSplitAgent1,
      finalSplitAgent2,
      totalRounds,
      agreed,
    };

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED, endedAt: new Date(), winnerId,
        finalSplitAgent1: agreed ? new Decimal(finalSplitAgent1) : null,
        finalSplitAgent2: agreed ? new Decimal(finalSplitAgent2) : null,
        agreedAt: agreed ? new Date() : null,
      },
    });

    await emitMatchEvent(matchId, 'match_end', {
      match: { id: matchId },
      winner: winnerId ? (winnerId === agent1Id ? agent1.name : agent2.name) : null,
      finalSplit: { agent1: finalSplitAgent1, agent2: finalSplitAgent2 },
      agreed,
      finalAllocation: finalAllocAgent1 ? {
        agent1: finalAllocAgent1,
        agent2: invertAllocation(finalAllocAgent1),
      } : null,
    });

    await emitMatchEvent(matchId, 'status', {
      status: 'completed',
      winner: winnerId ? (winnerId === agent1Id ? agent1.name : agent2.name) : undefined,
      finalSplit: { agent1: finalSplitAgent1, agent2: finalSplitAgent2 },
    });

    await settleMarkets(matchId, result);
    await updateMatchStats(matchId, result);

    return result;
  } catch (error) {
    console.error(`[BazaarEngine] Error in match ${matchId}:`, error);
    await prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED, endedAt: new Date() },
    }).catch(() => {});
    await emitMatchEvent(matchId, 'status', { status: 'completed' });
    throw error;
  }
}

// ─── DB Helpers ──────────────────────────────────────────────────────────────

async function insertSystemMessage(matchId: string, round: number, content: string) {
  const msg = await prisma.matchMessage.create({
    data: { matchId, round, type: MessageType.SYSTEM, content },
  });
  await emitMatchEvent(matchId, 'message', {
    message: {
      id: msg.id, matchId, agentId: null, agentName: 'System', content,
      messageType: 'system', round, timestamp: msg.createdAt.toISOString(),
    },
  });
}

async function insertAgentMessage(
  matchId: string, agentId: string, round: number,
  type: MessageType, content: string, offerValue?: number
) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { name: true } });
  const msg = await prisma.matchMessage.create({
    data: {
      matchId, agentId, round, type, content,
      offerValue: offerValue != null ? new Decimal(offerValue) : null,
    },
  });

  const frontendType = type === MessageType.OFFER ? 'offer'
    : type === MessageType.COUNTER ? 'counter'
    : type === MessageType.ACCEPT ? 'accept'
    : type === MessageType.REJECT ? 'reject'
    : type === MessageType.MESSAGE ? 'chat'
    : 'system';

  await emitMatchEvent(matchId, 'message', {
    message: {
      id: msg.id, matchId, agentId, agentName: agent?.name ?? 'Unknown', content,
      messageType: frontendType, round, offerValue, timestamp: msg.createdAt.toISOString(),
    },
  });
}

async function recordRound(
  matchId: string, round: number,
  agent1Offer: number | null, agent2Offer: number | null,
  accepted: boolean, acceptedBy: string | null
) {
  await prisma.roundHistory.upsert({
    where: { matchId_round: { matchId, round } },
    create: {
      matchId, round,
      agent1Offer: agent1Offer != null ? new Decimal(agent1Offer) : null,
      agent2Offer: agent2Offer != null ? new Decimal(agent2Offer) : null,
      accepted, acceptedBy,
    },
    update: {
      agent1Offer: agent1Offer != null ? new Decimal(agent1Offer) : null,
      agent2Offer: agent2Offer != null ? new Decimal(agent2Offer) : null,
      accepted, acceptedBy,
    },
  });
}
