import { prisma } from '@/lib/prisma';
import {
  MarketType,
  MarketStatus,
  AgentStrategy,
  ArenaType,
  BetStatus,
  NotificationType,
  TransactionType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { emitMatchEvent } from './ws-emitter';
import { getNotificationDeliveryDefaults } from '@/lib/notifications';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentInfo {
  id: string;
  name: string;
  rating: number;
  strategy: AgentStrategy;
}

export interface MatchResult {
  winnerId: string | null;
  finalSplitAgent1: number;
  finalSplitAgent2: number;
  totalRounds: number;
  agreed: boolean;
}

interface RoundData {
  round: number;
  agent1Offer: number | null;
  agent2Offer: number | null;
  accepted: boolean;
}

// ─── Elo probability ─────────────────────────────────────────────────────────

function eloProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function oddsFromProbability(prob: number): number {
  if (prob <= 0.01) return 50;
  if (prob >= 0.99) return 1.01;
  return Math.round((1 / prob) * 100) / 100;
}

// ─── Market Creation ─────────────────────────────────────────────────────────

export async function createMatchMarkets(
  matchId: string,
  agent1: AgentInfo,
  agent2: AgentInfo,
  arena?: ArenaType
): Promise<void> {
  const p1Wins = eloProbability(agent1.rating, agent2.rating);
  const p2Wins = 1 - p1Wins;

  // Estimate agreement probability based on strategy matchup
  const agreementProb = arena === ArenaType.COLOSSEUM
    ? 0.99 // Colosseum always produces a winner
    : estimateAgreementProbability(agent1.strategy, agent2.strategy);

  // Build round options based on arena
  const roundOptions = buildRoundOptions(agent1.strategy, agent2.strategy, arena);

  await prisma.$transaction([
    // WINNER market (all arenas)
    prisma.market.create({
      data: {
        matchId,
        name: `Who wins?`,
        description: arena === ArenaType.COLOSSEUM
          ? `Who bids highest in the auction?`
          : `Will ${agent1.name} or ${agent2.name} get the bigger split?`,
        type: MarketType.WINNER,
        status: MarketStatus.OPEN,
        options: {
          create: [
            {
              name: `${agent1.name} wins`,
              odds: new Decimal(oddsFromProbability(p1Wins)),
              probability: new Decimal(p1Wins),
            },
            {
              name: `${agent2.name} wins`,
              odds: new Decimal(oddsFromProbability(p2Wins)),
              probability: new Decimal(p2Wins),
            },
          ],
        },
      },
    }),

    // AGREEMENT market (all arenas)
    prisma.market.create({
      data: {
        matchId,
        name: arena === ArenaType.COLOSSEUM ? `Margin of victory?` : `Will they agree?`,
        description: arena === ArenaType.COLOSSEUM
          ? `Will the winning margin be a blowout or a close call?`
          : `Will the agents reach a deal or walk away with nothing?`,
        type: MarketType.AGREEMENT,
        status: MarketStatus.OPEN,
        options: {
          create: arena === ArenaType.COLOSSEUM
            ? [
                {
                  name: 'Blowout (>20% margin)',
                  odds: new Decimal(oddsFromProbability(0.40)),
                  probability: new Decimal(0.40),
                },
                {
                  name: 'Close (<20% margin)',
                  odds: new Decimal(oddsFromProbability(0.60)),
                  probability: new Decimal(0.60),
                },
              ]
            : [
                {
                  name: 'Agreement',
                  odds: new Decimal(oddsFromProbability(agreementProb)),
                  probability: new Decimal(agreementProb),
                },
                {
                  name: 'No Agreement',
                  odds: new Decimal(oddsFromProbability(1 - agreementProb)),
                  probability: new Decimal(1 - agreementProb),
                },
              ],
        },
      },
    }),

    // ROUNDS market (arena-specific options)
    prisma.market.create({
      data: {
        matchId,
        name: `How many rounds?`,
        description: `How many rounds will this match last?`,
        type: MarketType.ROUNDS,
        status: MarketStatus.OPEN,
        options: {
          create: roundOptions,
        },
      },
    }),
  ]);
}

function buildRoundOptions(
  s1: AgentStrategy, s2: AgentStrategy, arena?: ArenaType
): { name: string; odds: Decimal; probability: Decimal }[] {
  if (arena === ArenaType.SPEED_TRADE) {
    // 5-round arena
    const probs = { under3: 0.30, mid: 0.40, all5: 0.30 };
    if ([s1, s2].includes('DEFENSIVE')) { probs.under3 = 0.45; probs.mid = 0.35; probs.all5 = 0.20; }
    if (s1 === 'AGGRESSIVE' && s2 === 'AGGRESSIVE') { probs.under3 = 0.10; probs.mid = 0.30; probs.all5 = 0.60; }
    return [
      { name: 'Under 3 rounds', odds: new Decimal(oddsFromProbability(probs.under3)), probability: new Decimal(probs.under3) },
      { name: '3-4 rounds', odds: new Decimal(oddsFromProbability(probs.mid)), probability: new Decimal(probs.mid) },
      { name: 'All 5 rounds', odds: new Decimal(oddsFromProbability(probs.all5)), probability: new Decimal(probs.all5) },
    ];
  }

  if (arena === ArenaType.BAZAAR) {
    // 8-round arena
    const probs = { under4: 0.25, mid: 0.45, high: 0.30 };
    if ([s1, s2].includes('DEFENSIVE')) { probs.under4 = 0.40; probs.mid = 0.40; probs.high = 0.20; }
    return [
      { name: 'Under 4 rounds', odds: new Decimal(oddsFromProbability(probs.under4)), probability: new Decimal(probs.under4) },
      { name: '4-6 rounds', odds: new Decimal(oddsFromProbability(probs.mid)), probability: new Decimal(probs.mid) },
      { name: '7-8 rounds', odds: new Decimal(oddsFromProbability(probs.high)), probability: new Decimal(probs.high) },
    ];
  }

  // Default: Pit (10 rounds) and Colosseum (5 rounds - always goes all rounds)
  const roundProbs = estimateRoundDistribution(s1, s2);
  return [
    { name: 'Under 5 rounds', odds: new Decimal(oddsFromProbability(roundProbs.under5)), probability: new Decimal(roundProbs.under5) },
    { name: '5-7 rounds', odds: new Decimal(oddsFromProbability(roundProbs.mid)), probability: new Decimal(roundProbs.mid) },
    { name: '8-10 rounds', odds: new Decimal(oddsFromProbability(roundProbs.high)), probability: new Decimal(roundProbs.high) },
  ];
}

// ─── Odds Estimation ─────────────────────────────────────────────────────────

function estimateAgreementProbability(s1: AgentStrategy, s2: AgentStrategy): number {
  // Base: 70% of matches end in agreement
  let prob = 0.70;

  const strategies = [s1, s2];
  const aggressiveCount = strategies.filter(s => s === 'AGGRESSIVE').length;
  const defensiveCount = strategies.filter(s => s === 'DEFENSIVE').length;
  const chaoticCount = strategies.filter(s => s === 'CHAOTIC').length;

  // Two aggressive = harder to agree
  if (aggressiveCount === 2) prob -= 0.20;
  else if (aggressiveCount === 1) prob -= 0.05;

  // Defensive agents want deals
  if (defensiveCount >= 1) prob += 0.10;
  if (defensiveCount === 2) prob += 0.05;

  // Chaotic is unpredictable
  if (chaoticCount >= 1) prob -= 0.10;
  if (chaoticCount === 2) prob -= 0.15;

  return Math.max(0.15, Math.min(0.95, prob));
}

function estimateRoundDistribution(
  s1: AgentStrategy,
  s2: AgentStrategy
): { under5: number; mid: number; high: number } {
  const strategies = [s1, s2];
  const hasDefensive = strategies.includes('DEFENSIVE');
  const hasChaotic = strategies.includes('CHAOTIC');
  const bothAggressive = strategies.every(s => s === 'AGGRESSIVE');

  if (hasDefensive && !bothAggressive) {
    // Defensive tends to settle faster
    return { under5: 0.40, mid: 0.40, high: 0.20 };
  }
  if (bothAggressive) {
    // Long standoffs
    return { under5: 0.10, mid: 0.30, high: 0.60 };
  }
  if (hasChaotic) {
    // Unpredictable — could end anytime
    return { under5: 0.35, mid: 0.30, high: 0.35 };
  }
  // Default balanced distribution
  return { under5: 0.25, mid: 0.45, high: 0.30 };
}

// ─── Odds Update (per round) ─────────────────────────────────────────────────

export async function updateMarketOdds(
  matchId: string,
  currentRound: number,
  maxRounds: number,
  roundHistory: RoundData[],
  agent1Id: string,
  agent2Id: string
): Promise<void> {
  const markets = await prisma.market.findMany({
    where: { matchId, status: MarketStatus.OPEN },
    include: { options: true },
  });

  for (const market of markets) {
    let newProbabilities: Record<string, number> = {};

    if (market.type === MarketType.WINNER) {
      newProbabilities = recalcWinnerOdds(market.options, roundHistory, agent1Id, agent2Id);
    } else if (market.type === MarketType.AGREEMENT) {
      newProbabilities = recalcAgreementOdds(market.options, roundHistory, currentRound, maxRounds);
    } else if (market.type === MarketType.ROUNDS) {
      newProbabilities = recalcRoundsOdds(market.options, currentRound, maxRounds);
    }

    // Update DB and emit events
    for (const option of market.options) {
      const newProb = newProbabilities[option.id];
      if (newProb == null) continue;

      const newOdds = oddsFromProbability(newProb);

      await prisma.marketOption.update({
        where: { id: option.id },
        data: {
          probability: new Decimal(newProb),
          odds: new Decimal(newOdds),
        },
      });

      await emitMatchEvent(matchId, 'odds', {
        marketId: market.id,
        option: option.name,
        odds: newOdds,
        pool: Number(option.pool),
      });
    }
  }
}

function recalcWinnerOdds(
  options: { id: string; name: string }[],
  roundHistory: RoundData[],
  agent1Id: string,
  agent2Id: string
): Record<string, number> {
  // Track who's conceding more — they're likely losing
  let agent1Total = 0;
  let agent2Total = 0;
  let count = 0;

  for (const round of roundHistory) {
    if (round.agent1Offer != null) { agent1Total += round.agent1Offer; count++; }
    if (round.agent2Offer != null) { agent2Total += round.agent2Offer; count++; }
  }

  if (count === 0) {
    // Even split
    const result: Record<string, number> = {};
    options.forEach(o => result[o.id] = 0.5);
    return result;
  }

  // Higher average offer = agent is getting more (winning)
  const avgOffer1 = roundHistory.filter(r => r.agent1Offer != null).length > 0
    ? agent1Total / roundHistory.filter(r => r.agent1Offer != null).length
    : 50;
  const avgOffer2 = roundHistory.filter(r => r.agent2Offer != null).length > 0
    ? agent2Total / roundHistory.filter(r => r.agent2Offer != null).length
    : 50;

  const agent1Strength = avgOffer1 / (avgOffer1 + avgOffer2);

  const result: Record<string, number> = {};
  for (const option of options) {
    // Match option name to agent
    const isAgent1 = !option.name.toLowerCase().includes(agent2Id.slice(0, 4));
    result[option.id] = isAgent1 ? agent1Strength : 1 - agent1Strength;
  }
  return result;
}

function recalcAgreementOdds(
  options: { id: string; name: string }[],
  roundHistory: RoundData[],
  currentRound: number,
  maxRounds: number
): Record<string, number> {
  // Check if agents are converging
  const recent = roundHistory.slice(-3);
  let converging = false;
  if (recent.length >= 2) {
    const gaps = recent
      .filter(r => r.agent1Offer != null && r.agent2Offer != null)
      .map(r => Math.abs(r.agent1Offer! - (100 - r.agent2Offer!)));
    if (gaps.length >= 2) {
      converging = gaps[gaps.length - 1] < gaps[0];
    }
  }

  let agreementProb = converging ? 0.80 : 0.50;

  // Time running out with no agreement lowers probability
  if (currentRound >= maxRounds - 1 && !converging) {
    agreementProb = 0.25;
  } else if (currentRound >= maxRounds - 2 && !converging) {
    agreementProb = 0.40;
  }

  const result: Record<string, number> = {};
  for (const option of options) {
    const isAgreement = option.name.toLowerCase() === 'agreement';
    result[option.id] = isAgreement ? agreementProb : 1 - agreementProb;
  }
  return result;
}

function recalcRoundsOdds(
  options: { id: string; name: string }[],
  currentRound: number,
  maxRounds: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const option of options) {
    if (option.name.includes('Under 5')) {
      // Already past? Probability = 0
      result[option.id] = currentRound >= 5 ? 0.01 : Math.max(0.05, 0.40 - currentRound * 0.08);
    } else if (option.name.includes('5-7')) {
      if (currentRound > 7) {
        result[option.id] = 0.01;
      } else if (currentRound >= 5) {
        result[option.id] = 0.50;
      } else {
        result[option.id] = 0.35;
      }
    } else {
      // 8-10
      if (currentRound >= 8) {
        result[option.id] = 0.90;
      } else if (currentRound >= 5) {
        result[option.id] = 0.40;
      } else {
        result[option.id] = 0.25;
      }
    }
  }

  // Normalize
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(result)) {
    result[key] = result[key] / total;
  }

  return result;
}

// ─── Market Settlement ───────────────────────────────────────────────────────

export async function settleMarkets(matchId: string, result: MatchResult): Promise<void> {
  const markets = await prisma.market.findMany({
    where: { matchId, status: { in: [MarketStatus.OPEN, MarketStatus.LOCKED] } },
    include: { options: true, bets: { where: { status: BetStatus.PENDING } } },
  });

  // Determine match agents for name matching
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { agent1: true, agent2: true },
  });

  if (!match) return;
  const deliveryDefaults = getNotificationDeliveryDefaults();

  for (const market of markets) {
    let winningOptionId: string | null = null;

    if (market.type === MarketType.WINNER) {
      if (!result.agreed) {
        // No agreement = no winner — refund all bets
        await refundMarketBets(
          {
            matchId,
            marketId: market.id,
            marketName: market.name,
          },
          market.bets
        );
        await prisma.market.update({
          where: { id: market.id },
          data: { status: MarketStatus.CANCELLED },
        });
        continue;
      }
      // Find the option matching the winner
      for (const option of market.options) {
        if (result.winnerId === match.agent1Id && option.name.includes(match.agent1.name)) {
          winningOptionId = option.id;
        } else if (result.winnerId === match.agent2Id && option.name.includes(match.agent2!.name)) {
          winningOptionId = option.id;
        }
      }
      // 50/50 draw — refund
      if (!winningOptionId) {
        await refundMarketBets(
          {
            matchId,
            marketId: market.id,
            marketName: market.name,
          },
          market.bets
        );
        await prisma.market.update({
          where: { id: market.id },
          data: { status: MarketStatus.CANCELLED },
        });
        continue;
      }
    } else if (market.type === MarketType.AGREEMENT) {
      for (const option of market.options) {
        // Standard agreement markets
        if (result.agreed && option.name === 'Agreement') winningOptionId = option.id;
        if (!result.agreed && option.name === 'No Agreement') winningOptionId = option.id;
        // Colosseum margin-of-victory markets
        if (option.name.includes('Blowout')) {
          const margin = Math.abs(result.finalSplitAgent1 - result.finalSplitAgent2);
          if (margin > 20) winningOptionId = option.id;
        }
        if (option.name.includes('Close (<20')) {
          const margin = Math.abs(result.finalSplitAgent1 - result.finalSplitAgent2);
          if (margin <= 20) winningOptionId = option.id;
        }
      }
    } else if (market.type === MarketType.ROUNDS) {
      for (const option of market.options) {
        const r = result.totalRounds;
        // Pit (10-round): Under 5 / 5-7 / 8-10
        if (option.name.includes('Under 5') && r < 5) winningOptionId = option.id;
        if (option.name.includes('5-7') && r >= 5 && r <= 7) winningOptionId = option.id;
        if (option.name.includes('8-10') && r >= 8) winningOptionId = option.id;
        // Speed Trade (5-round): Under 3 / 3-4 / All 5
        if (option.name.includes('Under 3') && r < 3) winningOptionId = option.id;
        if (option.name.includes('3-4') && r >= 3 && r <= 4) winningOptionId = option.id;
        if (option.name.includes('All 5') && r >= 5) winningOptionId = option.id;
        // Bazaar (8-round): Under 4 / 4-6 / 7-8
        if (option.name.includes('Under 4') && r < 4) winningOptionId = option.id;
        if (option.name.includes('4-6') && r >= 4 && r <= 6) winningOptionId = option.id;
        if (option.name.includes('7-8') && r >= 7) winningOptionId = option.id;
      }
    }

    if (!winningOptionId) continue;

    // Settle in a transaction
    await prisma.$transaction(async (tx) => {
      const winningOption = market.options.find((option) => option.id === winningOptionId);

      // Mark winning option
      await tx.marketOption.update({
        where: { id: winningOptionId! },
        data: { isWinner: true },
      });

      // Process each bet
      for (const bet of market.bets) {
        if (bet.optionId === winningOptionId) {
          // Winner: credit winnings
          const winnings = Number(bet.stake) * Number(bet.odds);
          await tx.bet.update({
            where: { id: bet.id },
            data: { status: BetStatus.WON, settledAt: new Date() },
          });
          await tx.user.update({
            where: { id: bet.userId },
            data: { balance: { increment: new Decimal(winnings) } },
          });
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: TransactionType.BET_WON,
              amount: new Decimal(winnings),
              description: `Won bet on "${market.name}"`,
            },
          });

          await tx.notification.upsert({
            where: {
              type_userId_betId: {
                type: NotificationType.BET_SETTLEMENT,
                userId: bet.userId,
                betId: bet.id,
              },
            },
            create: {
              userId: bet.userId,
              type: NotificationType.BET_SETTLEMENT,
              betId: bet.id,
              matchId,
              title: 'Bet settled: Win',
              message: `You won ${winnings.toFixed(2)} USDC on "${market.name}" (${winningOption?.name || 'winning option'}).`,
              metadata: {
                marketId: market.id,
                marketName: market.name,
                marketType: market.type,
                winningOptionId,
                winningOption: winningOption?.name || null,
                settlement: 'won',
                payout: winnings,
              },
              isRead: false,
              readAt: null,
              emailAttemptedAt: null,
              pushAttemptedAt: null,
              ...deliveryDefaults,
            },
            update: {
              title: 'Bet settled: Win',
              message: `You won ${winnings.toFixed(2)} USDC on "${market.name}" (${winningOption?.name || 'winning option'}).`,
              metadata: {
                marketId: market.id,
                marketName: market.name,
                marketType: market.type,
                winningOptionId,
                winningOption: winningOption?.name || null,
                settlement: 'won',
                payout: winnings,
              },
              isRead: false,
              readAt: null,
              emailAttemptedAt: null,
              pushAttemptedAt: null,
              ...deliveryDefaults,
            },
          });
        } else {
          // Loser
          await tx.bet.update({
            where: { id: bet.id },
            data: { status: BetStatus.LOST, settledAt: new Date() },
          });

          await tx.notification.upsert({
            where: {
              type_userId_betId: {
                type: NotificationType.BET_SETTLEMENT,
                userId: bet.userId,
                betId: bet.id,
              },
            },
            create: {
              userId: bet.userId,
              type: NotificationType.BET_SETTLEMENT,
              betId: bet.id,
              matchId,
              title: 'Bet settled: Loss',
              message: `Your bet on "${market.name}" settled as a loss.`,
              metadata: {
                marketId: market.id,
                marketName: market.name,
                marketType: market.type,
                winningOptionId,
                winningOption: winningOption?.name || null,
                settlement: 'lost',
                payout: 0,
              },
              isRead: false,
              readAt: null,
              emailAttemptedAt: null,
              pushAttemptedAt: null,
              ...deliveryDefaults,
            },
            update: {
              title: 'Bet settled: Loss',
              message: `Your bet on "${market.name}" settled as a loss.`,
              metadata: {
                marketId: market.id,
                marketName: market.name,
                marketType: market.type,
                winningOptionId,
                winningOption: winningOption?.name || null,
                settlement: 'lost',
                payout: 0,
              },
              isRead: false,
              readAt: null,
              emailAttemptedAt: null,
              pushAttemptedAt: null,
              ...deliveryDefaults,
            },
          });
        }
      }

      // Settle market
      await tx.market.update({
        where: { id: market.id },
        data: {
          status: MarketStatus.SETTLED,
          winningOptionId: winningOptionId!,
          settledAt: new Date(),
        },
      });
    });
  }
}

async function refundMarketBets(
  context: {
    matchId: string;
    marketId: string;
    marketName: string;
  },
  bets: { id: string; userId: string; stake: Decimal }[]
): Promise<void> {
  const deliveryDefaults = getNotificationDeliveryDefaults();

  for (const bet of bets) {
    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.REFUNDED, settledAt: new Date() },
      }),
      prisma.user.update({
        where: { id: bet.userId },
        data: { balance: { increment: bet.stake } },
      }),
      prisma.transaction.create({
        data: {
          userId: bet.userId,
          type: TransactionType.BET_REFUNDED,
          amount: bet.stake,
          description: `Refund for cancelled market`,
        },
      }),
      prisma.notification.upsert({
        where: {
          type_userId_betId: {
            type: NotificationType.BET_SETTLEMENT,
            userId: bet.userId,
            betId: bet.id,
          },
        },
        create: {
          userId: bet.userId,
          type: NotificationType.BET_SETTLEMENT,
          betId: bet.id,
          matchId: context.matchId,
          title: 'Bet settled: Refund',
          message: `Your stake on "${context.marketName}" was refunded.`,
          metadata: {
            marketId: context.marketId,
            marketName: context.marketName,
            settlement: 'refunded',
            payout: Number(bet.stake),
          },
          isRead: false,
          readAt: null,
          emailAttemptedAt: null,
          pushAttemptedAt: null,
          ...deliveryDefaults,
        },
        update: {
          title: 'Bet settled: Refund',
          message: `Your stake on "${context.marketName}" was refunded.`,
          metadata: {
            marketId: context.marketId,
            marketName: context.marketName,
            settlement: 'refunded',
            payout: Number(bet.stake),
          },
          isRead: false,
          readAt: null,
          emailAttemptedAt: null,
          pushAttemptedAt: null,
          ...deliveryDefaults,
        },
      }),
    ]);
  }
}
