import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createTournament } from '@/lib/tournament-service';
import { toFrontendArena, formatMatch } from '@/lib/api-utils';

function toFrontendTournamentStatus(status: string): 'open' | 'live' | 'completed' | 'cancelled' {
  if (status === 'OPEN') return 'open';
  if (status === 'LIVE') return 'live';
  if (status === 'CANCELLED') return 'cancelled';
  return 'completed';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where: {
      status?: 'OPEN' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
    } = {};

    if (status) {
      const statusMap: Record<string, 'OPEN' | 'LIVE' | 'COMPLETED' | 'CANCELLED'> = {
        open: 'OPEN',
        live: 'LIVE',
        completed: 'COMPLETED',
        cancelled: 'CANCELLED',
      };
      if (statusMap[status]) where.status = statusMap[status];
    }

    const [items, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        include: {
          winner: { select: { id: true, name: true } },
          entries: { select: { id: true } },
          matches: {
            where: { tournamentRound: { equals: 1 } },
            include: {
              agent1: { include: { user: true } },
              agent2: { include: { user: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.tournament.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        arena: toFrontendArena(item.arena),
        status: toFrontendTournamentStatus(item.status),
        maxParticipants: item.maxParticipants,
        currentRound: item.currentRound,
        participantCount: item.entries.length,
        winner: item.winner ? { id: item.winner.id, name: item.winner.name } : null,
        startedAt: item.matches[0]?.startedAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error listing tournaments:', error);
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `Tournament ${new Date().toLocaleString()}`;
    const arena = typeof body.arena === 'string' ? body.arena : 'the-pit';
    const maxParticipants = typeof body.maxParticipants === 'number' ? body.maxParticipants : 8;
    const creatorWalletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : undefined;
    const agentIds = Array.isArray(body.agentIds)
      ? body.agentIds.filter((value: unknown): value is string => typeof value === 'string')
      : undefined;

    const tournament = await createTournament({
      name,
      arena,
      maxParticipants,
      creatorWalletAddress,
      agentIds,
    });

    const fullTournament = await prisma.tournament.findUnique({
      where: { id: tournament.id },
      include: {
        entries: {
          include: { agent: { include: { user: true } } },
          orderBy: { seed: 'asc' },
        },
        matches: {
          include: {
            agent1: { include: { user: true } },
            agent2: { include: { user: true } },
          },
          orderBy: [{ tournamentRound: 'asc' }, { tournamentSlot: 'asc' }],
        },
      },
    });

    if (!fullTournament) {
      return NextResponse.json({ error: 'Failed to load tournament' }, { status: 500 });
    }

    return NextResponse.json({
      tournament: {
        id: fullTournament.id,
        name: fullTournament.name,
        arena: toFrontendArena(fullTournament.arena),
        status: toFrontendTournamentStatus(fullTournament.status),
        maxParticipants: fullTournament.maxParticipants,
        currentRound: fullTournament.currentRound,
        participantCount: fullTournament.entries.length,
        createdAt: fullTournament.createdAt.toISOString(),
      },
      entries: fullTournament.entries.map((entry) => ({
        id: entry.id,
        seed: entry.seed,
        eliminatedRound: entry.eliminatedRound,
        agent: {
          id: entry.agent.id,
          name: entry.agent.name,
          rating: entry.agent.rating,
          strategy: entry.agent.strategy.toLowerCase(),
          walletAddress: entry.agent.user.walletAddress,
        },
      })),
      matches: fullTournament.matches.map(formatMatch),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create tournament';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
