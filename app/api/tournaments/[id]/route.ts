import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatMatch, toFrontendArena } from '@/lib/api-utils';

function toFrontendTournamentStatus(status: string): 'open' | 'live' | 'completed' | 'cancelled' {
  if (status === 'OPEN') return 'open';
  if (status === 'LIVE') return 'live';
  if (status === 'CANCELLED') return 'cancelled';
  return 'completed';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: {
        winner: { select: { id: true, name: true } },
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

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const rounds = tournament.matches.reduce<Record<string, ReturnType<typeof formatMatch>[]>>((acc, match) => {
      const key = String(match.tournamentRound || 0);
      if (!acc[key]) acc[key] = [];
      acc[key].push(formatMatch(match));
      return acc;
    }, {});

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        arena: toFrontendArena(tournament.arena),
        status: toFrontendTournamentStatus(tournament.status),
        maxParticipants: tournament.maxParticipants,
        currentRound: tournament.currentRound,
        participantCount: tournament.entries.length,
        winner: tournament.winner ? { id: tournament.winner.id, name: tournament.winner.name } : null,
        createdAt: tournament.createdAt.toISOString(),
        updatedAt: tournament.updatedAt.toISOString(),
      },
      entries: tournament.entries.map((entry) => ({
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
      rounds,
      matches: tournament.matches.map(formatMatch),
    });
  } catch (error) {
    console.error('Error loading tournament:', error);
    return NextResponse.json({ error: 'Failed to fetch tournament' }, { status: 500 });
  }
}
