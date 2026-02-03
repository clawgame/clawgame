import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatMarket } from '@/lib/api-utils';
import { MarketStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: {
      matchId?: string;
      status?: MarketStatus;
    } = {};

    if (matchId) {
      where.matchId = matchId;
    }

    if (status) {
      const statusMap: Record<string, MarketStatus> = {
        'open': 'OPEN',
        'closed': 'LOCKED',
        'settled': 'SETTLED',
      };
      if (statusMap[status]) {
        where.status = statusMap[status];
      }
    }

    // Get markets with options
    const markets = await prisma.market.findMany({
      where,
      include: {
        options: true,
        match: {
          include: {
            agent1: { include: { user: true } },
            agent2: { include: { user: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Format response
    const formattedMarkets = markets.map(formatMarket);

    return NextResponse.json(formattedMarkets);
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
