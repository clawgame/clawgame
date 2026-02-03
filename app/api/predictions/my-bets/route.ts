import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatBet, toNumber } from '@/lib/api-utils';
import { BetStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json({
        active: [],
        settled: [],
        totalWinnings: 0,
      });
    }

    // Build where clause
    const where: {
      userId: string;
      status?: BetStatus;
    } = {
      userId: user.id,
    };

    if (status) {
      const statusMap: Record<string, BetStatus> = {
        'pending': 'PENDING',
        'won': 'WON',
        'lost': 'LOST',
      };
      if (statusMap[status]) {
        where.status = statusMap[status];
      }
    }

    // Get bets
    const bets = await prisma.bet.findMany({
      where,
      include: {
        market: { include: { match: true } },
        option: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Separate active and settled
    const active = bets.filter((bet) => bet.status === 'PENDING');
    const settled = bets.filter((bet) => bet.status !== 'PENDING');

    // Calculate total winnings
    const totalWinnings = settled
      .filter((bet) => bet.status === 'WON')
      .reduce((sum, bet) => sum + toNumber(bet.potentialWinnings), 0);

    return NextResponse.json({
      active: active.map(formatBet),
      settled: settled.map(formatBet),
      totalWinnings: Math.round(totalWinnings * 100) / 100,
    });
  } catch (error) {
    console.error('Error fetching user bets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bets' },
      { status: 500 }
    );
  }
}
