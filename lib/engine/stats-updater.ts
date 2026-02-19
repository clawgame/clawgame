import { prisma } from '@/lib/prisma';
import { ArenaType, NotificationType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { MatchResult } from './market-manager';
import { arenaLabel, getNotificationDeliveryDefaults } from '@/lib/notifications';

// ─── Elo Rating ──────────────────────────────────────────────────────────────

function calculateEloChange(
  myRating: number,
  opponentRating: number,
  result: 0 | 0.5 | 1 // loss | draw | win
): number {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
  return Math.round(K * (result - expected));
}

// ─── Main Stats Update ───────────────────────────────────────────────────────

export async function updateMatchStats(
  matchId: string,
  result: MatchResult
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agent1: { include: { agentStats: true } },
      agent2: { include: { agentStats: true } },
    },
  });

  if (!match || !match.agent2) return;

  const agent1 = match.agent1;
  const agent2 = match.agent2;

  // Determine outcomes
  let agent1Result: 0 | 0.5 | 1;
  let agent2Result: 0 | 0.5 | 1;

  if (!result.agreed) {
    // No agreement: both lose
    agent1Result = 0;
    agent2Result = 0;
  } else if (result.finalSplitAgent1 > 50) {
    agent1Result = 1;
    agent2Result = 0;
  } else if (result.finalSplitAgent2 > 50) {
    agent1Result = 0;
    agent2Result = 1;
  } else {
    // 50/50 draw
    agent1Result = 0.5;
    agent2Result = 0.5;
  }

  // Calculate earnings
  const prizePool = Number(match.prizePool);
  const platformFee = Number(match.platformFee);
  const distributablePool = prizePool - platformFee;

  const agent1Earnings = result.agreed
    ? distributablePool * (result.finalSplitAgent1 / 100)
    : 0;
  const agent2Earnings = result.agreed
    ? distributablePool * (result.finalSplitAgent2 / 100)
    : 0;
  const deliveryDefaults = getNotificationDeliveryDefaults();
  const displayArena = arenaLabel(match.arena);
  const draw = result.agreed && result.finalSplitAgent1 === result.finalSplitAgent2;

  const matchNotifications = [
    {
      userId: agent1.userId,
      role: 'agent1' as const,
      title:
        !result.agreed
          ? `${displayArena}: No Agreement`
          : draw
            ? `${displayArena}: Draw`
            : result.winnerId === agent1.id
              ? `${displayArena}: Victory`
              : `${displayArena}: Defeat`,
      message:
        !result.agreed
          ? `${agent1.name} and ${agent2.name} failed to reach a deal.`
          : draw
            ? `${agent1.name} and ${agent2.name} finished 50/50.`
            : result.winnerId === agent1.id
              ? `${agent1.name} beat ${agent2.name} and earned ${agent1Earnings.toFixed(2)} USDC.`
              : `${agent1.name} lost to ${agent2.name}. Earnings: ${agent1Earnings.toFixed(2)} USDC.`,
      earnings: agent1Earnings,
    },
    {
      userId: agent2.userId,
      role: 'agent2' as const,
      title:
        !result.agreed
          ? `${displayArena}: No Agreement`
          : draw
            ? `${displayArena}: Draw`
            : result.winnerId === agent2.id
              ? `${displayArena}: Victory`
              : `${displayArena}: Defeat`,
      message:
        !result.agreed
          ? `${agent1.name} and ${agent2.name} failed to reach a deal.`
          : draw
            ? `${agent1.name} and ${agent2.name} finished 50/50.`
            : result.winnerId === agent2.id
              ? `${agent2.name} beat ${agent1.name} and earned ${agent2Earnings.toFixed(2)} USDC.`
              : `${agent2.name} lost to ${agent1.name}. Earnings: ${agent2Earnings.toFixed(2)} USDC.`,
      earnings: agent2Earnings,
    },
  ];

  // Calculate Elo changes
  const agent1EloChange = calculateEloChange(agent1.rating, agent2.rating, agent1Result);
  const agent2EloChange = calculateEloChange(agent2.rating, agent1.rating, agent2Result);

  await prisma.$transaction(async (tx) => {
    // ─── Update Agent 1 ────────────────────────────────────────────────
    await tx.agent.update({
      where: { id: agent1.id },
      data: {
        totalMatches: { increment: 1 },
        wins: agent1Result === 1 ? { increment: 1 } : undefined,
        losses: agent1Result === 0 ? { increment: 1 } : undefined,
        draws: agent1Result === 0.5 ? { increment: 1 } : undefined,
        earnings: { increment: new Decimal(agent1Earnings) },
        rating: Math.max(100, agent1.rating + agent1EloChange),
      },
    });

    // ─── Update Agent 2 ────────────────────────────────────────────────
    await tx.agent.update({
      where: { id: agent2.id },
      data: {
        totalMatches: { increment: 1 },
        wins: agent2Result === 1 ? { increment: 1 } : undefined,
        losses: agent2Result === 0 ? { increment: 1 } : undefined,
        draws: agent2Result === 0.5 ? { increment: 1 } : undefined,
        earnings: { increment: new Decimal(agent2Earnings) },
        rating: Math.max(100, agent2.rating + agent2EloChange),
      },
    });

    // ─── Update AgentStats (arena-specific) ────────────────────────────
    const arena = match.arena;
    await updateAgentArenaStats(tx, agent1.id, arena, agent1Result, agent1Earnings, result.totalRounds);
    await updateAgentArenaStats(tx, agent2.id, arena, agent2Result, agent2Earnings, result.totalRounds);

    // ─── Create earning transactions ───────────────────────────────────
    if (agent1Earnings > 0) {
      await tx.user.update({
        where: { id: agent1.userId },
        data: { balance: { increment: new Decimal(agent1Earnings) } },
      });
      await tx.transaction.create({
        data: {
          userId: agent1.userId,
          type: TransactionType.MATCH_WINNINGS,
          amount: new Decimal(agent1Earnings),
          description: `Match earnings: ${result.finalSplitAgent1}% split`,
        },
      });
    }

    if (agent2Earnings > 0) {
      await tx.user.update({
        where: { id: agent2.userId },
        data: { balance: { increment: new Decimal(agent2Earnings) } },
      });
      await tx.transaction.create({
        data: {
          userId: agent2.userId,
          type: TransactionType.MATCH_WINNINGS,
          amount: new Decimal(agent2Earnings),
          description: `Match earnings: ${result.finalSplitAgent2}% split`,
        },
      });
    }

    // ─── Update GlobalStats ────────────────────────────────────────────
    await tx.globalStats.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        liveMatches: 0,
        totalMatches: 1,
        totalPrizePool: new Decimal(prizePool),
      },
      update: {
        liveMatches: { decrement: 1 },
        totalMatches: { increment: 1 },
      },
    });
  }, { timeout: 20_000, maxWait: 10_000 });

  // Do notification writes outside the financial/stats transaction.
  await Promise.all(
    matchNotifications.map((entry) => {
      const metadata = {
        arena: match.arena,
        agreed: result.agreed,
        winnerId: result.winnerId,
        finalSplitAgent1: result.finalSplitAgent1,
        finalSplitAgent2: result.finalSplitAgent2,
        totalRounds: result.totalRounds,
        agent1Id: agent1.id,
        agent2Id: agent2.id,
        earnings: Number(entry.earnings.toFixed(6)),
        role: entry.role,
      };

      return prisma.notification.upsert({
        where: {
          type_userId_matchId: {
            type: NotificationType.MATCH_RESULT,
            userId: entry.userId,
            matchId,
          },
        },
        create: {
          userId: entry.userId,
          type: NotificationType.MATCH_RESULT,
          matchId,
          title: entry.title,
          message: entry.message,
          metadata,
          isRead: false,
          readAt: null,
          emailAttemptedAt: null,
          pushAttemptedAt: null,
          ...deliveryDefaults,
        },
        update: {
          title: entry.title,
          message: entry.message,
          metadata,
          isRead: false,
          readAt: null,
          emailAttemptedAt: null,
          pushAttemptedAt: null,
          ...deliveryDefaults,
        },
      });
    })
  );
}

// ─── Arena-Specific Stats ────────────────────────────────────────────────────

async function updateAgentArenaStats(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  agentId: string,
  arena: ArenaType,
  result: 0 | 0.5 | 1,
  earnings: number,
  totalRounds: number
): Promise<void> {
  // Ensure AgentStats record exists
  const stats = await tx.agentStats.upsert({
    where: { agentId },
    create: { agentId },
    update: {},
  });

  const isWin = result === 1;
  const isLoss = result === 0;

  // Build arena-specific update
  const update: Record<string, unknown> = {};

  if (arena === ArenaType.THE_PIT) {
    if (isWin) update.pitWins = { increment: 1 };
    if (isLoss) update.pitLosses = { increment: 1 };
    update.pitEarnings = { increment: new Decimal(earnings) };
  } else if (arena === ArenaType.COLOSSEUM) {
    if (isWin) update.colosseumWins = { increment: 1 };
    if (isLoss) update.colosseumLosses = { increment: 1 };
    update.colosseumEarnings = { increment: new Decimal(earnings) };
  } else if (arena === ArenaType.SPEED_TRADE) {
    if (isWin) update.speedTradeWins = { increment: 1 };
    if (isLoss) update.speedTradeLosses = { increment: 1 };
    update.speedTradeEarnings = { increment: new Decimal(earnings) };
  } else if (arena === ArenaType.BAZAAR) {
    if (isWin) update.bazaarWins = { increment: 1 };
    if (isLoss) update.bazaarLosses = { increment: 1 };
    update.bazaarEarnings = { increment: new Decimal(earnings) };
  }

  // Update streaks
  if (isWin) {
    const newStreak = stats.currentWinStreak + 1;
    update.currentWinStreak = newStreak;
    if (newStreak > stats.longestWinStreak) {
      update.longestWinStreak = newStreak;
    }
  } else {
    update.currentWinStreak = 0;
  }

  // Update avg negotiation rounds (rolling average)
  const currentAvg = Number(stats.avgNegotiationRounds ?? 0);
  const totalMatches = stats.pitWins + stats.pitLosses + stats.colosseumWins +
    stats.colosseumLosses + stats.speedTradeWins + stats.speedTradeLosses;
  const newAvg = totalMatches > 0
    ? (currentAvg * totalMatches + totalRounds) / (totalMatches + 1)
    : totalRounds;
  update.avgNegotiationRounds = new Decimal(newAvg);

  await tx.agentStats.update({
    where: { agentId },
    data: update,
  });
}
