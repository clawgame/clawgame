import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatRankedAgent, toPrismaArena } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const arena = searchParams.get('arena');
    const period = searchParams.get('period') || 'all';
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause - for now just filter active agents
    // In a real implementation, we'd filter by time period
    const where = {
      isActive: true,
    };

    // Get order by field based on arena
    // For specific arenas, we could order by arena-specific stats
    let orderBy: { rating?: 'desc'; earnings?: 'desc' } = { rating: 'desc' };

    if (arena && arena !== 'all') {
      // Could enhance to sort by arena-specific earnings/wins
      orderBy = { earnings: 'desc' };
    }

    // Get agents
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        include: { user: true },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.agent.count({ where }),
    ]);

    // Format response with ranking
    const formattedAgents = agents.map((agent, index) =>
      formatRankedAgent(agent, offset + index)
    );

    return NextResponse.json({
      items: formattedAgents,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
