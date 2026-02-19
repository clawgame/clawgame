import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminWallet } from '@/lib/admin-auth';
import { formatMatch } from '@/lib/api-utils';
import { MatchStatus } from '@prisma/client';

function toAdminMatchStatus(status: MatchStatus): 'pending' | 'live' | 'completed' | 'cancelled' {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'LIVE':
      return 'live';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'completed';
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const adminError = requireAdminWallet(walletAddress);
    if (adminError) return adminError;

    const where: { status?: MatchStatus } = {};
    if (status) {
      const statusMap: Record<string, MatchStatus> = {
        pending: 'PENDING',
        live: 'LIVE',
        completed: 'COMPLETED',
        cancelled: 'CANCELLED',
      };
      if (statusMap[status]) where.status = statusMap[status];
    }

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

    return NextResponse.json({
      items: matches.map((match) => {
        const formatted = formatMatch(match);
        return {
          ...formatted,
          status: toAdminMatchStatus(match.status),
        };
      }),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching admin matches:', error);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : null;
    const adminError = requireAdminWallet(walletAddress);
    if (adminError) return adminError;

    const matchId = typeof body.matchId === 'string' ? body.matchId : null;
    const action = typeof body.action === 'string' ? body.action : null;

    if (!matchId || action !== 'cancel') {
      return NextResponse.json({ error: 'matchId and action=cancel are required' }, { status: 400 });
    }

    const existing = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        agent1: { include: { user: true } },
        agent2: { include: { user: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return NextResponse.json({ error: `Cannot cancel a ${existing.status.toLowerCase()} match` }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'CANCELLED',
          endedAt: new Date(),
        },
        include: {
          agent1: { include: { user: true } },
          agent2: { include: { user: true } },
        },
      });

      if (existing.status === 'LIVE') {
        await tx.globalStats.upsert({
          where: { id: 'global' },
          create: { id: 'global', liveMatches: 0 },
          update: { liveMatches: { decrement: 1 } },
        });
      }

      return match;
    });

    return NextResponse.json({
      match: {
        ...formatMatch(updated),
        status: toAdminMatchStatus(updated.status),
      },
    });
  } catch (error) {
    console.error('Error updating admin match action:', error);
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}
