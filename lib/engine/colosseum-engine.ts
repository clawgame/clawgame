import { prisma } from '@/lib/prisma';
import { MatchStatus, MessageType, ArenaType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { makeBid, type BidContext, type BidDecision } from './agent-ai';
import type { CustomStrategyConfig } from './custom-strategy';
import { createMatchMarkets, settleMarkets, type MatchResult } from './market-manager';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

export async function runColosseumMatch(config: MatchEngineConfig): Promise<MatchResult> {
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
      id: agent1Data.id, name: agent1Data.name, strategy: agent1Data.strategy,
      strategyConfig: agent1Data.strategyConfig as CustomStrategyConfig | null,
      rating: agent1Data.rating, wins: agent1Data.wins, losses: agent1Data.losses,
    };
    const agent2: LoadedAgent = {
      id: agent2Data.id, name: agent2Data.name, strategy: agent2Data.strategy,
      strategyConfig: agent2Data.strategyConfig as CustomStrategyConfig | null,
      rating: agent2Data.rating, wins: agent2Data.wins, losses: agent2Data.losses,
    };

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
      arena: 'COLOSSEUM',
      agent1: { id: agent1.id, name: agent1.name, strategy: agent1.strategy },
      agent2: { id: agent2.id, name: agent2.name, strategy: agent2.strategy },
    });

    await createMatchMarkets(matchId, agent1Data, agent2Data, ArenaType.COLOSSEUM);

    // ─── Sealed Bid Rounds ─────────────────────────────────────────────────
    const agent1Bids: number[] = [];
    const agent2Bids: number[] = [];

    for (let round = 1; round <= maxRounds; round++) {
      await prisma.match.update({
        where: { id: matchId },
        data: { round },
      });

      await emitMatchEvent(matchId, 'round', {
        round,
        maxRounds,
        phase: 'bidding',
      });

      await insertSystemMessage(matchId, round,
        `🏛️ Round ${round} of ${maxRounds}. Both agents submit sealed bids...`);
      await sleep(500);

      // Both agents bid simultaneously
      const bid1Ctx: BidContext = {
        myAgentId: agent1.id, myAgentName: agent1.name,
        opponentAgentName: agent2.name, myStrategy: agent1.strategy,
        currentRound: round, maxRounds, prizePool,
        myRating: agent1.rating, opponentRating: agent2.rating,
        myBidHistory: agent1Bids, myCustomConfig: agent1.strategyConfig,
      };

      const bid2Ctx: BidContext = {
        myAgentId: agent2.id, myAgentName: agent2.name,
        opponentAgentName: agent1.name, myStrategy: agent2.strategy,
        currentRound: round, maxRounds, prizePool,
        myRating: agent2.rating, opponentRating: agent1.rating,
        myBidHistory: agent2Bids, myCustomConfig: agent2.strategyConfig,
      };

      const decision1 = makeBid(bid1Ctx);
      const decision2 = makeBid(bid2Ctx);

      await sleep(Math.max(decision1.thinkingDelay, decision2.thinkingDelay));

      agent1Bids.push(decision1.bidValue);
      agent2Bids.push(decision2.bidValue);

      // Show bluff/commentary messages (bids stay hidden)
      await insertAgentMessage(matchId, agent1.id, round, MessageType.MESSAGE,
        decision1.message);
      await sleep(messageDelayMs * 0.5);
      await insertAgentMessage(matchId, agent2.id, round, MessageType.MESSAGE,
        decision2.message);

      // Emit round data (bids hidden from public)
      await emitMatchEvent(matchId, 'round', {
        round,
        maxRounds,
        phase: 'submitted',
        message: `Both agents have submitted their round ${round} bids.`,
      });

      await recordRound(matchId, round, null, null, false, null);
      await sleep(roundDelayMs);
    }

    // ─── Dramatic Reveal Phase ──────────────────────────────────────────────
    await emitMatchEvent(matchId, 'round', {
      round: maxRounds,
      maxRounds,
      phase: 'reveal',
    });

    await insertSystemMessage(matchId, maxRounds,
      `🏛️ All bids are in! Revealing results...`);
    await sleep(2000);

    // Reveal bids round by round
    for (let i = 0; i < maxRounds; i++) {
      await insertSystemMessage(matchId, maxRounds,
        `Round ${i + 1}: ${agent1.name} bid ${agent1Bids[i]}% | ${agent2.name} bid ${agent2Bids[i]}%`);
      await sleep(1500);
    }

    // Calculate winner using Vickrey auction
    const totalBid1 = agent1Bids.reduce((a, b) => a + b, 0);
    const totalBid2 = agent2Bids.reduce((a, b) => a + b, 0);

    let winnerId: string;
    let winnerName: string;
    let loserName: string;
    let winnerTotalBid: number;
    let loserTotalBid: number;

    if (totalBid1 > totalBid2) {
      winnerId = agent1Id;
      winnerName = agent1.name;
      loserName = agent2.name;
      winnerTotalBid = totalBid1;
      loserTotalBid = totalBid2;
    } else if (totalBid2 > totalBid1) {
      winnerId = agent2Id;
      winnerName = agent2.name;
      loserName = agent1.name;
      winnerTotalBid = totalBid2;
      loserTotalBid = totalBid1;
    } else {
      // Tie: winner is whoever had the higher first bid (earliest advantage)
      let tieWinner: 'agent1' | 'agent2' = 'agent1';
      for (let i = 0; i < maxRounds; i++) {
        if (agent1Bids[i] > agent2Bids[i]) { tieWinner = 'agent1'; break; }
        if (agent2Bids[i] > agent1Bids[i]) { tieWinner = 'agent2'; break; }
      }
      if (tieWinner === 'agent1') {
        winnerId = agent1Id;
        winnerName = agent1.name;
        loserName = agent2.name;
        winnerTotalBid = totalBid1;
        loserTotalBid = totalBid2;
      } else {
        winnerId = agent2Id;
        winnerName = agent2.name;
        loserName = agent1.name;
        winnerTotalBid = totalBid2;
        loserTotalBid = totalBid1;
      }
    }

    // Vickrey pricing: winner pays second-highest price
    // Payment = (loser's total bid / (maxRounds * 100)) * prizePool
    const paymentRate = loserTotalBid / (maxRounds * 100);
    const winnerPayment = paymentRate * prizePool;
    const winnerEarnings = prizePool - winnerPayment;

    // Map to split percentages
    const winnerPct = Math.round((winnerEarnings / prizePool) * 100);
    const loserPct = 100 - winnerPct;

    const finalSplitAgent1 = winnerId === agent1Id ? winnerPct : loserPct;
    const finalSplitAgent2 = winnerId === agent2Id ? winnerPct : loserPct;

    await sleep(1000);
    await insertSystemMessage(matchId, maxRounds,
      `🏛️ ${winnerName} wins with total bid ${winnerTotalBid}% vs ${loserName}'s ${loserTotalBid}%!`);
    await sleep(1000);
    await insertSystemMessage(matchId, maxRounds,
      `🏛️ Vickrey pricing: ${winnerName} pays ${loserName}'s rate. Split: ${finalSplitAgent1}/${finalSplitAgent2}.`);

    // ─── Settlement ────────────────────────────────────────────────────────
    const result: MatchResult = {
      winnerId,
      finalSplitAgent1,
      finalSplitAgent2,
      totalRounds: maxRounds,
      agreed: true, // Colosseum always resolves
    };

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED, endedAt: new Date(), winnerId,
        finalSplitAgent1: new Decimal(finalSplitAgent1),
        finalSplitAgent2: new Decimal(finalSplitAgent2),
        agreedAt: new Date(),
      },
    });

    await emitMatchEvent(matchId, 'match_end', {
      match: { id: matchId },
      winner: winnerName,
      finalSplit: { agent1: finalSplitAgent1, agent2: finalSplitAgent2 },
      agreed: true,
      bids: { agent1: agent1Bids, agent2: agent2Bids },
    });

    await emitMatchEvent(matchId, 'status', {
      status: 'completed',
      winner: winnerName,
      finalSplit: { agent1: finalSplitAgent1, agent2: finalSplitAgent2 },
    });

    await settleMarkets(matchId, result);
    await updateMatchStats(matchId, result);

    return result;
  } catch (error) {
    console.error(`[ColosseumEngine] Error in match ${matchId}:`, error);
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
