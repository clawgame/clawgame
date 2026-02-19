import { prisma } from '@/lib/prisma';
import { MatchStatus, MessageType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { makeDecision, type NegotiationContext, type RoundRecord, type AgentDecision } from './agent-ai';
import type { CustomStrategyConfig } from './custom-strategy';
import { createMatchMarkets, updateMarketOdds, settleMarkets, type MatchResult } from './market-manager';
import { updateMatchStats } from './stats-updater';
import { emitMatchEvent } from './ws-emitter';
import { PLATFORM_FEE } from '@/lib/constants';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function prismaMessageType(action: AgentDecision['action']): MessageType {
  switch (action) {
    case 'OFFER': return MessageType.OFFER;
    case 'COUNTER': return MessageType.COUNTER;
    case 'ACCEPT': return MessageType.ACCEPT;
    case 'REJECT': return MessageType.REJECT;
    case 'MESSAGE': return MessageType.MESSAGE;
  }
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

export async function runPitMatch(config: MatchEngineConfig): Promise<MatchResult> {
  const {
    matchId,
    agent1Id,
    agent2Id,
    maxRounds,
    prizePool,
    roundDelayMs = 3000,
    messageDelayMs = 1500,
  } = config;

  try {
    // Load agents
    const [agent1Data, agent2Data] = await Promise.all([
      prisma.agent.findUniqueOrThrow({ where: { id: agent1Id } }),
      prisma.agent.findUniqueOrThrow({ where: { id: agent2Id } }),
    ]);

    const agent1: LoadedAgent = {
      id: agent1Data.id,
      name: agent1Data.name,
      strategy: agent1Data.strategy,
      strategyConfig: agent1Data.strategyConfig as CustomStrategyConfig | null,
      rating: agent1Data.rating,
      wins: agent1Data.wins,
      losses: agent1Data.losses,
    };

    const agent2: LoadedAgent = {
      id: agent2Data.id,
      name: agent2Data.name,
      strategy: agent2Data.strategy,
      strategyConfig: agent2Data.strategyConfig as CustomStrategyConfig | null,
      rating: agent2Data.rating,
      wins: agent2Data.wins,
      losses: agent2Data.losses,
    };

    // Transition to LIVE
    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.LIVE,
        startedAt: new Date(),
        round: 0,
      },
    });

    // Update global stats
    await prisma.globalStats.upsert({
      where: { id: 'global' },
      create: { id: 'global', liveMatches: 1 },
      update: { liveMatches: { increment: 1 } },
    });

    await emitMatchEvent(matchId, 'match_start', {
      matchId,
      agent1: { id: agent1.id, name: agent1.name, strategy: agent1.strategy },
      agent2: { id: agent2.id, name: agent2.name, strategy: agent2.strategy },
    });

    // Create prediction markets
    await createMatchMarkets(matchId, agent1Data, agent2Data);

    // Determine who goes first (higher rating with small random factor)
    const ratingDiff = agent1.rating - agent2.rating;
    const firstMoverIsAgent1 = ratingDiff + (Math.random() * 100 - 50) > 0;

    // ─── Game Loop ───────────────────────────────────────────────────────
    const roundHistory: RoundRecord[] = [];
    let agreed = false;
    let finalSplitAgent1 = 0;
    let finalSplitAgent2 = 0;
    let lastOfferAgent1: number | null = null; // what agent1 asked for themselves
    let lastOfferAgent2: number | null = null; // what agent2 asked for themselves
    let totalRounds = 0;

    for (let round = 1; round <= maxRounds; round++) {
      totalRounds = round;

      // Update round in DB
      await prisma.match.update({
        where: { id: matchId },
        data: { round },
      });

      await emitMatchEvent(matchId, 'round', {
        round,
        maxRounds,
        currentOffer: lastOfferAgent1 != null || lastOfferAgent2 != null
          ? { agent1: lastOfferAgent1 ?? 50, agent2: lastOfferAgent2 ?? 50 }
          : null,
      });

      // Determine active agent this round (alternating)
      const agent1Active = (round % 2 === 1) === firstMoverIsAgent1;
      const activeAgent = agent1Active ? agent1 : agent2;
      const passiveAgent = agent1Active ? agent2 : agent1;

      // System message
      await insertSystemMessage(matchId, round, `Round ${round}. ${activeAgent.name}'s turn.`);
      await sleep(500);

      // ─── Active agent makes a decision ─────────────────────────────────
      const activeCtx = buildContext(
        matchId, activeAgent, passiveAgent, round, maxRounds, prizePool,
        roundHistory, agent1Active,
        agent1Active ? lastOfferAgent2 : lastOfferAgent1, // what was last offered TO the active agent
        true
      );

      const activeDecision = makeDecision(activeCtx);
      await sleep(activeDecision.thinkingDelay);

      // Record the message
      await insertAgentMessage(
        matchId, activeAgent.id, round,
        prismaMessageType(activeDecision.action),
        activeDecision.message,
        activeDecision.offerValue
      );

      // Update last offers
      if (activeDecision.action === 'OFFER' || activeDecision.action === 'COUNTER') {
        if (agent1Active) {
          lastOfferAgent1 = activeDecision.offerValue!;
        } else {
          lastOfferAgent2 = activeDecision.offerValue!;
        }

        // Update currentSplit in DB for the match page
        await prisma.match.update({
          where: { id: matchId },
          data: {
            finalSplitAgent1: new Decimal(lastOfferAgent1 ?? 50),
            finalSplitAgent2: new Decimal(lastOfferAgent2 ?? 50),
          },
        });
      }

      // ─── Active agent accepts (the opponent's previous offer) ──────────
      if (activeDecision.action === 'ACCEPT') {
        // Active agent accepted what was offered to them
        const acceptedOffer = agent1Active ? lastOfferAgent2 : lastOfferAgent1;
        if (acceptedOffer != null) {
          // The accepted offer is what the PASSIVE agent asked for
          if (agent1Active) {
            finalSplitAgent1 = 100 - acceptedOffer; // agent1 gets what was offered to them
            finalSplitAgent2 = acceptedOffer; // agent2 gets what they asked for
          } else {
            finalSplitAgent2 = 100 - acceptedOffer; // agent2 gets what was offered to them
            finalSplitAgent1 = acceptedOffer; // agent1 gets what they asked for
          }
          agreed = true;
          roundHistory.push({
            round,
            offeredByMe: true,
            myOffer: null,
            opponentOffer: null,
            accepted: true,
          });
          await recordRound(matchId, round, lastOfferAgent1, lastOfferAgent2, true, activeAgent.id);
          break;
        }
      }

      // ─── If active made an offer/counter, passive agent responds ───────
      if (activeDecision.action === 'OFFER' || activeDecision.action === 'COUNTER') {
        await sleep(messageDelayMs);

        // What is being offered TO the passive agent?
        const offeredToPassive = 100 - activeDecision.offerValue!;

        const passiveCtx = buildContext(
          matchId, passiveAgent, activeAgent, round, maxRounds, prizePool,
          roundHistory, !agent1Active,
          offeredToPassive, // what the active agent offered the passive agent (as %)
          false
        );

        const passiveDecision = makeDecision(passiveCtx);
        await sleep(passiveDecision.thinkingDelay);

        await insertAgentMessage(
          matchId, passiveAgent.id, round,
          prismaMessageType(passiveDecision.action),
          passiveDecision.message,
          passiveDecision.offerValue
        );

        // Update last offers if passive countered
        if (passiveDecision.action === 'COUNTER' || passiveDecision.action === 'OFFER') {
          if (!agent1Active) {
            lastOfferAgent1 = passiveDecision.offerValue!;
          } else {
            lastOfferAgent2 = passiveDecision.offerValue!;
          }
        }

        // Passive agent accepts
        if (passiveDecision.action === 'ACCEPT') {
          // Passive accepted what active offered
          if (agent1Active) {
            finalSplitAgent1 = activeDecision.offerValue!;
            finalSplitAgent2 = 100 - activeDecision.offerValue!;
          } else {
            finalSplitAgent2 = activeDecision.offerValue!;
            finalSplitAgent1 = 100 - activeDecision.offerValue!;
          }
          agreed = true;
          await recordRound(matchId, round, lastOfferAgent1, lastOfferAgent2, true, passiveAgent.id);
          break;
        }
      }

      // Record round (no agreement this round)
      roundHistory.push({
        round,
        offeredByMe: agent1Active,
        myOffer: agent1Active ? lastOfferAgent1 : lastOfferAgent2,
        opponentOffer: agent1Active ? lastOfferAgent2 : lastOfferAgent1,
        accepted: false,
      });

      await recordRound(matchId, round, lastOfferAgent1, lastOfferAgent2, false, null);

      // Update market odds
      const roundData = roundHistory.map(r => ({
        round: r.round,
        agent1Offer: r.myOffer,
        agent2Offer: r.opponentOffer,
        accepted: r.accepted,
      }));
      await updateMarketOdds(matchId, round, maxRounds, roundData, agent1Id, agent2Id);

      // Delay between rounds
      await sleep(roundDelayMs);
    }

    // ─── Settlement ────────────────────────────────────────────────────────
    const result: MatchResult = {
      winnerId: agreed
        ? (finalSplitAgent1 > 50 ? agent1Id : finalSplitAgent2 > 50 ? agent2Id : null)
        : null,
      finalSplitAgent1,
      finalSplitAgent2,
      totalRounds,
      agreed,
    };

    // Final system message
    if (agreed) {
      await insertSystemMessage(
        matchId, totalRounds,
        `Deal! ${agent1.name} gets ${finalSplitAgent1}%, ${agent2.name} gets ${finalSplitAgent2}%.`
      );
    } else {
      await insertSystemMessage(
        matchId, totalRounds,
        `No agreement reached after ${maxRounds} rounds. Both agents walk away with nothing.`
      );
    }

    // Update match record
    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED,
        endedAt: new Date(),
        winnerId: result.winnerId,
        finalSplitAgent1: agreed ? new Decimal(finalSplitAgent1) : null,
        finalSplitAgent2: agreed ? new Decimal(finalSplitAgent2) : null,
        agreedAt: agreed ? new Date() : null,
      },
    });

    // Emit match end
    await emitMatchEvent(matchId, 'match_end', {
      match: { id: matchId },
      winner: result.winnerId
        ? (result.winnerId === agent1Id ? agent1.name : agent2.name)
        : null,
      finalSplit: { agent1: finalSplitAgent1, agent2: finalSplitAgent2 },
      agreed,
    });

    await emitMatchEvent(matchId, 'status', {
      status: 'completed',
      winner: result.winnerId
        ? (result.winnerId === agent1Id ? agent1.name : agent2.name)
        : undefined,
      finalSplit: { agent1: finalSplitAgent1, agent2: finalSplitAgent2 },
    });

    // Settle markets and update stats
    await settleMarkets(matchId, result);
    await updateMatchStats(matchId, result);

    return result;
  } catch (error) {
    console.error(`[MatchEngine] Error in match ${matchId}:`, error);

    // Mark match as cancelled on error
    await prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED, endedAt: new Date() },
    }).catch(() => {});

    await emitMatchEvent(matchId, 'status', { status: 'completed' });

    throw error;
  }
}

// ─── Context Builder ─────────────────────────────────────────────────────────

function buildContext(
  matchId: string,
  me: LoadedAgent,
  opponent: LoadedAgent,
  round: number,
  maxRounds: number,
  prizePool: number,
  history: RoundRecord[],
  iAmAgent1: boolean,
  lastOfferToMe: number | null,
  isMyTurn: boolean
): NegotiationContext {
  // Build history from this agent's perspective
  const myHistory: RoundRecord[] = history.map(r => ({
    round: r.round,
    offeredByMe: iAmAgent1 ? r.offeredByMe : !r.offeredByMe,
    myOffer: iAmAgent1 ? r.myOffer : r.opponentOffer,
    opponentOffer: iAmAgent1 ? r.opponentOffer : r.myOffer,
    accepted: r.accepted,
  }));

  const myTotalMatches = me.wins + me.losses;
  const opTotalMatches = opponent.wins + opponent.losses;

  return {
    matchId,
    myAgentId: me.id,
    myAgentName: me.name,
    opponentAgentId: opponent.id,
    opponentAgentName: opponent.name,
    myStrategy: me.strategy,
    opponentStrategy: opponent.strategy,
    currentRound: round,
    maxRounds,
    prizePool,
    myRating: me.rating,
    opponentRating: opponent.rating,
    roundHistory: myHistory,
    lastOfferToMe,
    isMyTurn,
    myWinRate: myTotalMatches > 0 ? me.wins / myTotalMatches : 0.5,
    opponentWinRate: opTotalMatches > 0 ? opponent.wins / opTotalMatches : 0.5,
    myCustomConfig: me.strategyConfig,
  };
}

// ─── DB Helpers ──────────────────────────────────────────────────────────────

async function insertSystemMessage(matchId: string, round: number, content: string) {
  const msg = await prisma.matchMessage.create({
    data: {
      matchId,
      round,
      type: MessageType.SYSTEM,
      content,
    },
  });

  await emitMatchEvent(matchId, 'message', {
    message: {
      id: msg.id,
      matchId,
      agentId: null,
      agentName: 'System',
      content,
      messageType: 'system',
      round,
      timestamp: msg.createdAt.toISOString(),
    },
  });
}

async function insertAgentMessage(
  matchId: string,
  agentId: string,
  round: number,
  type: MessageType,
  content: string,
  offerValue?: number
) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { name: true } });

  const msg = await prisma.matchMessage.create({
    data: {
      matchId,
      agentId,
      round,
      type,
      content,
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
      id: msg.id,
      matchId,
      agentId,
      agentName: agent?.name ?? 'Unknown',
      content,
      messageType: frontendType,
      round,
      offerValue,
      timestamp: msg.createdAt.toISOString(),
    },
  });
}

async function recordRound(
  matchId: string,
  round: number,
  agent1Offer: number | null,
  agent2Offer: number | null,
  accepted: boolean,
  acceptedBy: string | null
) {
  await prisma.roundHistory.upsert({
    where: { matchId_round: { matchId, round } },
    create: {
      matchId,
      round,
      agent1Offer: agent1Offer != null ? new Decimal(agent1Offer) : null,
      agent2Offer: agent2Offer != null ? new Decimal(agent2Offer) : null,
      accepted,
      acceptedBy,
    },
    update: {
      agent1Offer: agent1Offer != null ? new Decimal(agent1Offer) : null,
      agent2Offer: agent2Offer != null ? new Decimal(agent2Offer) : null,
      accepted,
      acceptedBy,
    },
  });
}
