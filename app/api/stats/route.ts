import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toNumber } from '@/lib/api-utils';

export async function GET() {
  try {
    // Try to get existing global stats
    let globalStats = await prisma.globalStats.findUnique({
      where: { id: 'global' },
    });

    // If no stats exist, calculate them
    if (!globalStats) {
      const [liveMatches, totalAgents, totalPrizePool, totalBets] = await Promise.all([
        prisma.match.count({ where: { status: 'LIVE' } }),
        prisma.agent.count({ where: { isActive: true } }),
        prisma.match.aggregate({
          _sum: { prizePool: true },
          where: { status: { in: ['LIVE', 'PENDING'] } },
        }),
        prisma.bet.count(),
      ]);

      globalStats = await prisma.globalStats.upsert({
        where: { id: 'global' },
        create: {
          id: 'global',
          liveMatches,
          totalAgents,
          totalPrizePool: totalPrizePool._sum.prizePool || 0,
          totalBets,
        },
        update: {
          liveMatches,
          totalAgents,
          totalPrizePool: totalPrizePool._sum.prizePool || 0,
          totalBets,
        },
      });
    }

    return NextResponse.json({
      liveMatches: globalStats.liveMatches,
      totalPrizePool: toNumber(globalStats.totalPrizePool),
      totalAgents: globalStats.totalAgents,
      totalBetsPlaced: globalStats.totalBets,
    });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
