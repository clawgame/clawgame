import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatBet, toNumber } from '@/lib/api-utils';
import { Decimal } from '@prisma/client/runtime/library';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, marketId, optionId, stake, walletAddress } = body;

    // Validate required fields
    if (!marketId || !optionId || !stake || !walletAddress) {
      return NextResponse.json(
        { error: 'Market ID, option ID, stake, and wallet address are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please connect your wallet first.' },
        { status: 404 }
      );
    }

    // Check user balance
    if (toNumber(user.balance) < stake) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // Get market and option
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { options: true, match: true },
    });

    if (!market) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    if (market.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Market is not open for betting' },
        { status: 400 }
      );
    }

    const option = market.options.find((o) => o.id === optionId);
    if (!option) {
      return NextResponse.json(
        { error: 'Option not found' },
        { status: 404 }
      );
    }

    // Calculate potential winnings
    const potentialWinnings = stake * toNumber(option.odds);

    // Create bet in a transaction
    const bet = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: user.id },
        data: { balance: { decrement: stake } },
      });

      // Create bet
      const newBet = await tx.bet.create({
        data: {
          userId: user.id,
          marketId: market.id,
          optionId: option.id,
          stake: new Decimal(stake),
          odds: option.odds,
          potentialWinnings: new Decimal(potentialWinnings),
        },
        include: {
          market: { include: { match: true } },
          option: true,
        },
      });

      // Update market pool
      await tx.market.update({
        where: { id: marketId },
        data: {
          totalPool: { increment: stake },
          totalBets: { increment: 1 },
        },
      });

      // Update option pool
      await tx.marketOption.update({
        where: { id: optionId },
        data: {
          pool: { increment: stake },
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'BET_PLACED',
          amount: new Decimal(-stake),
          balanceBefore: user.balance,
          balanceAfter: new Decimal(toNumber(user.balance) - stake),
          betId: newBet.id,
          matchId: market.matchId,
          description: `Bet on ${option.name} in ${market.name}`,
        },
      });

      // Update global stats
      await tx.globalStats.upsert({
        where: { id: 'global' },
        create: {
          id: 'global',
          totalBets: 1,
          totalBetVolume: new Decimal(stake),
        },
        update: {
          totalBets: { increment: 1 },
          totalBetVolume: { increment: stake },
        },
      });

      return newBet;
    });

    return NextResponse.json(formatBet(bet), { status: 201 });
  } catch (error) {
    console.error('Error placing bet:', error);
    return NextResponse.json(
      { error: 'Failed to place bet' },
      { status: 500 }
    );
  }
}
