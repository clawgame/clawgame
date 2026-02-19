import prisma from '@/lib/prisma';
import { ARENAS } from '@/lib/constants';
import { toPrismaArena } from '@/lib/api-utils';
import {
  ArenaType,
  Match,
  MatchStatus,
  Tournament,
  TournamentEntry,
  TournamentStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { runPitMatch } from '@/lib/engine/match-engine';
import { runSpeedTradeMatch } from '@/lib/engine/speed-trade-engine';
import { runColosseumMatch } from '@/lib/engine/colosseum-engine';
import { runBazaarMatch } from '@/lib/engine/bazaar-engine';

type TournamentWithEntries = Tournament & {
  entries: Array<TournamentEntry & { agent: { id: string; rating: number } }>;
};

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function getArenaKey(arena: ArenaType): keyof typeof ARENAS {
  switch (arena) {
    case 'THE_PIT':
      return 'the-pit';
    case 'COLOSSEUM':
      return 'colosseum';
    case 'SPEED_TRADE':
      return 'speed-trade';
    case 'BAZAAR':
      return 'bazaar';
    default:
      return 'the-pit';
  }
}

function maxRoundsForArena(arena: ArenaType): number {
  return ARENAS[getArenaKey(arena)].maxRounds;
}

async function runMatchEngine(arena: ArenaType, config: {
  matchId: string;
  agent1Id: string;
  agent2Id: string;
  maxRounds: number;
  prizePool: number;
}): Promise<void> {
  if (arena === 'THE_PIT') {
    await runPitMatch(config);
    return;
  }
  if (arena === 'SPEED_TRADE') {
    await runSpeedTradeMatch(config);
    return;
  }
  if (arena === 'COLOSSEUM') {
    await runColosseumMatch(config);
    return;
  }
  await runBazaarMatch(config);
}

function roundOnePairings(agentIdsBySeed: string[]): Array<[string, string]> {
  const pairings: Array<[string, string]> = [];
  let left = 0;
  let right = agentIdsBySeed.length - 1;

  while (left < right) {
    pairings.push([agentIdsBySeed[left], agentIdsBySeed[right]]);
    left += 1;
    right -= 1;
  }

  return pairings;
}

function nextRoundPairings(winnerIds: string[]): Array<[string, string]> {
  const pairings: Array<[string, string]> = [];
  for (let i = 0; i < winnerIds.length; i += 2) {
    pairings.push([winnerIds[i], winnerIds[i + 1]]);
  }
  return pairings;
}

async function createRoundMatches(args: {
  tournamentId: string;
  arena: ArenaType;
  round: number;
  pairings: Array<[string, string]>;
}): Promise<Match[]> {
  const { tournamentId, arena, round, pairings } = args;
  const maxRounds = maxRoundsForArena(arena);

  const matches = await Promise.all(
    pairings.map(([agent1Id, agent2Id], index) =>
      prisma.match.create({
        data: {
          tournamentId,
          tournamentRound: round,
          tournamentSlot: index,
          arena,
          status: MatchStatus.PENDING,
          agent1Id,
          agent2Id,
          maxRounds,
          round: 0,
          prizePool: new Decimal(0),
          platformFee: new Decimal(0),
        },
      })
    )
  );

  for (const match of matches) {
    runMatchEngine(arena, {
      matchId: match.id,
      agent1Id: match.agent1Id,
      agent2Id: match.agent2Id || '',
      maxRounds: match.maxRounds,
      prizePool: Number(match.prizePool),
    }).catch((error) => {
      console.error(`[Tournament] Match engine failed for ${match.id}:`, error);
    });
  }

  return matches;
}

export async function createTournament(input: {
  name: string;
  arena: string;
  maxParticipants: number;
  creatorWalletAddress?: string;
  agentIds?: string[];
}) {
  const prismaArena = toPrismaArena(input.arena);
  if (!prismaArena) {
    throw new Error('Invalid arena');
  }
  if (![4, 8, 16].includes(input.maxParticipants)) {
    throw new Error('maxParticipants must be 4, 8, or 16');
  }

  const uniqueAgentIds = Array.from(new Set(input.agentIds || []));
  if (uniqueAgentIds.length > input.maxParticipants) {
    throw new Error('Too many initial agent IDs');
  }

  let createdByUserId: string | undefined;
  if (input.creatorWalletAddress) {
    const creator = await prisma.user.findUnique({
      where: { walletAddress: input.creatorWalletAddress },
      select: { id: true },
    });
    createdByUserId = creator?.id;
  }

  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.create({
      data: {
        name: input.name,
        arena: prismaArena,
        maxParticipants: input.maxParticipants,
        createdByUserId,
      },
    });

    if (uniqueAgentIds.length > 0) {
      const agents = await tx.agent.findMany({
        where: {
          id: { in: uniqueAgentIds },
          isActive: true,
        },
        select: { id: true },
      });

      if (agents.length !== uniqueAgentIds.length) {
        throw new Error('One or more initial agents are invalid or inactive');
      }

      await tx.tournamentEntry.createMany({
        data: uniqueAgentIds.map((agentId, index) => ({
          tournamentId: tournament.id,
          agentId,
          seed: index + 1,
        })),
      });
    }

    return tournament;
  });
}

export async function joinTournament(input: {
  tournamentId: string;
  agentId: string;
}) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      entries: {
        orderBy: { seed: 'asc' },
      },
    },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }
  if (tournament.status !== TournamentStatus.OPEN) {
    throw new Error('Tournament is not open for joining');
  }
  if (tournament.entries.length >= tournament.maxParticipants) {
    throw new Error('Tournament is full');
  }

  const agent = await prisma.agent.findUnique({
    where: { id: input.agentId },
    select: { id: true, isActive: true },
  });
  if (!agent || !agent.isActive) {
    throw new Error('Agent not found or inactive');
  }

  const existing = tournament.entries.find((entry) => entry.agentId === input.agentId);
  if (existing) {
    return {
      entry: existing,
      alreadyJoined: true,
      readyToStart: tournament.entries.length >= tournament.maxParticipants,
    };
  }

  const nextSeed = tournament.entries.length + 1;
  const entry = await prisma.tournamentEntry.create({
    data: {
      tournamentId: tournament.id,
      agentId: input.agentId,
      seed: nextSeed,
    },
  });

  return {
    entry,
    alreadyJoined: false,
    readyToStart: nextSeed >= tournament.maxParticipants,
  };
}

export async function startTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      entries: {
        include: {
          agent: { select: { id: true, rating: true } },
        },
        orderBy: { seed: 'asc' },
      },
    },
  }) as TournamentWithEntries | null;

  if (!tournament) throw new Error('Tournament not found');
  if (tournament.status !== TournamentStatus.OPEN) {
    throw new Error('Tournament already started');
  }
  if (!isPowerOfTwo(tournament.maxParticipants)) {
    throw new Error('Tournament maxParticipants must be power of two');
  }
  if (tournament.entries.length !== tournament.maxParticipants) {
    throw new Error(`Tournament needs exactly ${tournament.maxParticipants} entries to start`);
  }

  const agentIdsBySeed = tournament.entries.map((entry) => entry.agentId);
  const pairings = roundOnePairings(agentIdsBySeed);

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.LIVE,
      currentRound: 1,
    },
  });

  const matches = await createRoundMatches({
    tournamentId,
    arena: tournament.arena,
    round: 1,
    pairings,
  });

  return { tournamentId, round: 1, matchIds: matches.map((match) => match.id) };
}

function resolveWinner(match: Match & {
  agent1: { id: string; rating: number };
  agent2: { id: string; rating: number } | null;
}): string | null {
  if (match.winnerId) return match.winnerId;
  if (!match.agent2) return match.agent1.id;
  if (match.agent1.rating === match.agent2.rating) return match.agent1.id;
  return match.agent1.rating > match.agent2.rating ? match.agent1.id : match.agent2.id;
}

export async function syncTournamentRound(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
        include: {
          agent1: { select: { id: true, rating: true } },
          agent2: { select: { id: true, rating: true } },
        },
        orderBy: [{ tournamentRound: 'asc' }, { tournamentSlot: 'asc' }],
      },
    },
  });

  if (!tournament) throw new Error('Tournament not found');
  if (tournament.status !== TournamentStatus.LIVE) {
    return {
      status: tournament.status,
      advanced: false,
      reason: 'Tournament is not live',
    };
  }

  const currentRound = tournament.currentRound;
  const currentRoundMatches = tournament.matches.filter(
    (match) => match.tournamentRound === currentRound
  );

  if (currentRoundMatches.length === 0) {
    return {
      status: tournament.status,
      advanced: false,
      reason: 'No matches found for current round',
    };
  }

  const unfinished = currentRoundMatches.filter(
    (match) => match.status === MatchStatus.LIVE || match.status === MatchStatus.PENDING
  );
  if (unfinished.length > 0) {
    return {
      status: tournament.status,
      advanced: false,
      reason: 'Current round still in progress',
      pendingMatchIds: unfinished.map((match) => match.id),
    };
  }

  const winnerIds = currentRoundMatches
    .map((match) => resolveWinner(match))
    .filter((winnerId): winnerId is string => !!winnerId);

  const loserIds = currentRoundMatches
    .map((match) => {
      const winnerId = resolveWinner(match);
      if (!winnerId || !match.agent2) return null;
      return winnerId === match.agent1Id ? match.agent2Id : match.agent1Id;
    })
    .filter((value): value is string => !!value);

  if (winnerIds.length === 1) {
    const championId = winnerIds[0];
    await prisma.$transaction([
      prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          status: TournamentStatus.COMPLETED,
          winnerId: championId,
        },
      }),
      prisma.tournamentEntry.updateMany({
        where: {
          tournamentId,
          agentId: { in: loserIds },
          eliminatedRound: null,
        },
        data: { eliminatedRound: currentRound },
      }),
    ]);

    return {
      status: TournamentStatus.COMPLETED,
      advanced: true,
      completed: true,
      winnerId: championId,
      round: currentRound,
    };
  }

  const pairings = nextRoundPairings(winnerIds);
  const nextRound = currentRound + 1;

  await prisma.$transaction([
    prisma.tournament.update({
      where: { id: tournamentId },
      data: { currentRound: nextRound },
    }),
    prisma.tournamentEntry.updateMany({
      where: {
        tournamentId,
        agentId: { in: loserIds },
        eliminatedRound: null,
      },
      data: { eliminatedRound: currentRound },
    }),
  ]);

  const matches = await createRoundMatches({
    tournamentId,
    arena: tournament.arena,
    round: nextRound,
    pairings,
  });

  return {
    status: TournamentStatus.LIVE,
    advanced: true,
    completed: false,
    round: nextRound,
    matchIds: matches.map((match) => match.id),
  };
}
