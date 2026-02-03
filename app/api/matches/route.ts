import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatMatch, toPrismaMatchStatus, toPrismaArena } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const arena = searchParams.get('arena');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: {
      status?: ReturnType<typeof toPrismaMatchStatus>;
      arena?: ReturnType<typeof toPrismaArena>;
    } = {};

    if (status) {
      const prismaStatus = toPrismaMatchStatus(status);
      if (prismaStatus) where.status = prismaStatus;
    }

    if (arena) {
      const prismaArena = toPrismaArena(arena);
      if (prismaArena) where.arena = prismaArena;
    }

    // Get matches with agents
    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          agent1: { include: { user: true } },
          agent2: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.match.count({ where }),
    ]);

    // Format response
    const formattedMatches = matches.map(formatMatch);

    // If just asking for live matches (no pagination metadata needed)
    if (status === 'live' && !searchParams.has('limit')) {
      return NextResponse.json(formattedMatches);
    }

    // Return paginated response
    return NextResponse.json({
      items: formattedMatches,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}
