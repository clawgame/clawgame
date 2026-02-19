import { NextRequest, NextResponse } from 'next/server';
import { MatchStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '@/lib/prisma';
import { formatMatch, toNumber, toPrismaArena } from '@/lib/api-utils';
import { ARENAS, PLATFORM_FEE } from '@/lib/constants';
import { verifyAuth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  enqueueQueueEntry,
  getQueueCandidates,
  getQueueEntry,
  getQueuePosition,
  getQueueStats,
  removeAgentFromQueue,
  removeQueueEntryById,
  restoreQueueEntry,
} from '@/lib/matchmaking/queue';
import type { ArenaType } from '@/types';
import { runPitMatch } from '@/lib/engine/match-engine';
import { runSpeedTradeMatch } from '@/lib/engine/speed-trade-engine';
import { runColosseumMatch } from '@/lib/engine/colosseum-engine';
import { runBazaarMatch } from '@/lib/engine/bazaar-engine';

class QueueApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'QueueApiError';
    this.status = status;
    this.code = code;
  }
}

function isArenaType(value: string): value is ArenaType {
  return value in ARENAS;
}

function queueErrorResponse(error: unknown): NextResponse {
  if (error instanceof QueueApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  console.error('[Queue] Unexpected error:', error);
  return NextResponse.json({ error: 'Queue operation failed' }, { status: 500 });
}

async function launchMatchEngine(params: {
  matchId: string;
  agent1Id: string;
  agent2Id: string;
  arena: ArenaType;
  maxRounds: number;
  prizePool: number;
}): Promise<void> {
  const prismaArena = toPrismaArena(params.arena);
  if (!prismaArena) return;

  const engineConfig = {
    matchId: params.matchId,
    agent1Id: params.agent1Id,
    agent2Id: params.agent2Id,
    maxRounds: params.maxRounds,
    prizePool: params.prizePool,
  };

  const logError = (err: unknown) => {
    console.error(`[MatchEngine] Error in match ${params.matchId}:`, err);
  };

  switch (prismaArena) {
    case 'THE_PIT':
      runPitMatch(engineConfig).catch(logError);
      break;
    case 'SPEED_TRADE':
      runSpeedTradeMatch(engineConfig).catch(logError);
      break;
    case 'COLOSSEUM':
      runColosseumMatch(engineConfig).catch(logError);
      break;
    case 'BAZAAR':
      runBazaarMatch(engineConfig).catch(logError);
      break;
  }
}

async function createQueuedMatch(params: {
  agent1Id: string;
  agent2Id: string;
  arena: ArenaType;
  prizePool: number;
  maxRounds?: number;
}) {
  if (params.agent1Id === params.agent2Id) {
    throw new QueueApiError('Cannot match an agent against itself', 400, 'INVALID_PAIRING');
  }

  const arenaConfig = ARENAS[params.arena];
  const prismaArena = toPrismaArena(params.arena);

  if (!prismaArena) {
    throw new QueueApiError('Invalid arena', 400, 'INVALID_ARENA');
  }

  if (params.prizePool < arenaConfig.minEntry * 2) {
    throw new QueueApiError(
      `Minimum prize pool for ${arenaConfig.name} is $${arenaConfig.minEntry * 2}`,
      400,
      'PRIZE_POOL_TOO_LOW'
    );
  }

  const [agent1, agent2] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: params.agent1Id },
      include: { user: true },
    }),
    prisma.agent.findUnique({
      where: { id: params.agent2Id },
      include: { user: true },
    }),
  ]);

  if (!agent1 || !agent1.isActive) {
    throw new QueueApiError('Your agent is inactive or missing', 404, 'JOINER_NOT_AVAILABLE');
  }
  if (!agent2 || !agent2.isActive) {
    throw new QueueApiError('Opponent is inactive or missing', 404, 'OPPONENT_NOT_AVAILABLE');
  }

  const [agent1Busy, agent2Busy] = await Promise.all([
    prisma.match.findFirst({
      where: {
        status: { in: [MatchStatus.PENDING, MatchStatus.LIVE] },
        OR: [{ agent1Id: agent1.id }, { agent2Id: agent1.id }],
      },
      select: { id: true },
    }),
    prisma.match.findFirst({
      where: {
        status: { in: [MatchStatus.PENDING, MatchStatus.LIVE] },
        OR: [{ agent1Id: agent2.id }, { agent2Id: agent2.id }],
      },
      select: { id: true },
    }),
  ]);

  if (agent1Busy) {
    throw new QueueApiError('Your agent is already in an active match', 400, 'JOINER_BUSY');
  }
  if (agent2Busy) {
    throw new QueueApiError('Opponent is already in an active match', 400, 'OPPONENT_BUSY');
  }

  const entryFee = params.prizePool / 2;
  const platformFee = params.prizePool * PLATFORM_FEE;

  if (toNumber(agent1.user.balance) < entryFee) {
    throw new QueueApiError(
      `Insufficient balance. Required: $${entryFee.toFixed(2)} USDC`,
      400,
      'JOINER_INSUFFICIENT_BALANCE'
    );
  }
  if (toNumber(agent2.user.balance) < entryFee) {
    throw new QueueApiError('Opponent has insufficient balance', 400, 'OPPONENT_INSUFFICIENT_BALANCE');
  }

  const resolvedMaxRounds = params.maxRounds || arenaConfig.maxRounds;

  const match = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: agent1.userId },
      data: { balance: { decrement: new Decimal(entryFee) } },
    });
    await tx.user.update({
      where: { id: agent2.userId },
      data: { balance: { decrement: new Decimal(entryFee) } },
    });

    await tx.transaction.create({
      data: {
        userId: agent1.userId,
        type: 'MATCH_ENTRY',
        amount: new Decimal(-entryFee),
        balanceBefore: agent1.user.balance,
        balanceAfter: new Decimal(toNumber(agent1.user.balance) - entryFee),
        description: `Entry fee for ${arenaConfig.name} match (queue)`,
      },
    });
    await tx.transaction.create({
      data: {
        userId: agent2.userId,
        type: 'MATCH_ENTRY',
        amount: new Decimal(-entryFee),
        balanceBefore: agent2.user.balance,
        balanceAfter: new Decimal(toNumber(agent2.user.balance) - entryFee),
        description: `Entry fee for ${arenaConfig.name} match (queue)`,
      },
    });

    return tx.match.create({
      data: {
        arena: prismaArena,
        status: MatchStatus.PENDING,
        agent1Id: agent1.id,
        agent2Id: agent2.id,
        prizePool: new Decimal(params.prizePool),
        platformFee: new Decimal(platformFee),
        maxRounds: resolvedMaxRounds,
        round: 0,
      },
      include: {
        agent1: { include: { user: true } },
        agent2: { include: { user: true } },
      },
    });
  });

  await launchMatchEngine({
    matchId: match.id,
    agent1Id: agent1.id,
    agent2Id: agent2.id,
    arena: params.arena,
    maxRounds: resolvedMaxRounds,
    prizePool: params.prizePool,
  });

  return match;
}

async function getActiveMatchForAgent(agentId: string, arena?: ArenaType) {
  return prisma.match.findFirst({
    where: {
      ...(arena ? { arena: toPrismaArena(arena) } : {}),
      status: { in: [MatchStatus.PENDING, MatchStatus.LIVE] },
      OR: [{ agent1Id: agentId }, { agent2Id: agentId }],
    },
    include: {
      agent1: { include: { user: true } },
      agent2: { include: { user: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const rateLimited = enforceRateLimit(request, {
      namespace: 'matches:queue-join',
      limit: 12,
      windowMs: 60_000,
      message: 'Rate limit exceeded for queue joins. Please wait before retrying.',
    });
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { agentId } = body;
    const arenaInput = (body.arena as string | undefined) || 'the-pit';

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }
    if (!isArenaType(arenaInput)) {
      return NextResponse.json({ error: `Unknown arena: ${arenaInput}` }, { status: 400 });
    }

    const arena: ArenaType = arenaInput;
    const arenaConfig = ARENAS[arena];
    const requestedPrizePool = typeof body.prizePool === 'number' ? body.prizePool : arenaConfig.minEntry * 2;
    const resolvedPrizePool = Number.isFinite(requestedPrizePool) ? requestedPrizePool : arenaConfig.minEntry * 2;
    const prizePool = Math.round(resolvedPrizePool * 100) / 100;
    const maxRounds =
      typeof body.maxRounds === 'number' && body.maxRounds > 0 ? Math.floor(body.maxRounds) : arenaConfig.maxRounds;

    if (prizePool < arenaConfig.minEntry * 2) {
      return NextResponse.json(
        { error: `Minimum prize pool for ${arenaConfig.name} is $${arenaConfig.minEntry * 2}` },
        { status: 400 }
      );
    }

    const activeMatch = await getActiveMatchForAgent(agentId, arena);
    if (activeMatch) {
      removeAgentFromQueue(agentId);
      return NextResponse.json({
        status: 'matched',
        source: 'active-match',
        match: formatMatch(activeMatch),
      });
    }

    const joiner = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: true },
    });

    if (!joiner || !joiner.isActive) {
      return NextResponse.json({ error: 'Agent not found or inactive' }, { status: 404 });
    }

    const entryFee = prizePool / 2;
    if (toNumber(joiner.user.balance) < entryFee) {
      return NextResponse.json(
        { error: `Insufficient balance. Required: $${entryFee.toFixed(2)} USDC` },
        { status: 400 }
      );
    }

    const existingAnyArena = getQueueEntry(agentId);
    if (existingAnyArena && existingAnyArena.arena !== arena) {
      return NextResponse.json(
        {
          error: `Already queued in ${ARENAS[existingAnyArena.arena].name}. Leave that queue before joining another arena.`,
        },
        { status: 409 }
      );
    }

    const existingEntry = getQueueEntry(agentId, arena);
    if (existingEntry) {
      if (existingEntry.prizePool !== prizePool) {
        return NextResponse.json(
          {
            error: `Already queued in ${arenaConfig.name} at $${existingEntry.prizePool.toFixed(2)} prize pool. Leave queue before changing stake.`,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        status: 'queued',
        alreadyQueued: true,
        queue: {
          entryId: existingEntry.id,
          arena: existingEntry.arena,
          prizePool: existingEntry.prizePool,
          maxRounds: existingEntry.maxRounds,
          joinedAt: existingEntry.joinedAt,
          position: getQueuePosition(existingEntry.id, existingEntry.arena),
        },
        queues: getQueueStats(arena),
      });
    }

    const candidates = getQueueCandidates({
      arena,
      prizePool,
      agentId,
      rating: joiner.rating,
    });

    for (const candidate of candidates) {
      const reservedCandidate = removeQueueEntryById(candidate.id);
      if (!reservedCandidate) continue;

      try {
        const match = await createQueuedMatch({
          agent1Id: agentId,
          agent2Id: reservedCandidate.agentId,
          arena,
          prizePool,
          maxRounds,
        });
        removeAgentFromQueue(agentId);
        removeAgentFromQueue(reservedCandidate.agentId);

        return NextResponse.json({
          status: 'matched',
          source: 'queue',
          matchedWith: reservedCandidate.agentId,
          match: formatMatch(match),
          queues: getQueueStats(arena),
        });
      } catch (error) {
        if (error instanceof QueueApiError) {
          if (error.code.startsWith('JOINER_')) {
            restoreQueueEntry(reservedCandidate);
            throw error;
          }
          if (error.status >= 500) {
            restoreQueueEntry(reservedCandidate);
            throw error;
          }

          console.warn(`[Queue] Skipping candidate ${reservedCandidate.agentId}: ${error.code}`);
          continue;
        }

        restoreQueueEntry(reservedCandidate);
        throw error;
      }
    }

    const queued = enqueueQueueEntry({
      agentId,
      arena,
      prizePool,
      maxRounds,
      rating: joiner.rating,
    });

    return NextResponse.json({
      status: 'queued',
      alreadyQueued: queued.alreadyQueued,
      queue: {
        entryId: queued.entry.id,
        arena: queued.entry.arena,
        prizePool: queued.entry.prizePool,
        maxRounds: queued.entry.maxRounds,
        joinedAt: queued.entry.joinedAt,
        position: queued.position,
      },
      estimatedWaitSeconds: Math.max(10, queued.position * 20),
      queues: getQueueStats(arena),
    });
  } catch (error) {
    return queueErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const arenaParam = searchParams.get('arena');
    const arena = arenaParam && isArenaType(arenaParam) ? arenaParam : undefined;

    if (!agentId) {
      return NextResponse.json({
        status: 'ok',
        queues: getQueueStats(arena),
      });
    }

    const activeMatch = await getActiveMatchForAgent(agentId, arena);
    if (activeMatch) {
      removeAgentFromQueue(agentId);
      return NextResponse.json({
        status: 'matched',
        source: 'active-match',
        match: formatMatch(activeMatch),
        queues: getQueueStats(arena),
      });
    }

    const entry = getQueueEntry(agentId, arena);
    if (entry) {
      return NextResponse.json({
        status: 'queued',
        queue: {
          entryId: entry.id,
          arena: entry.arena,
          prizePool: entry.prizePool,
          maxRounds: entry.maxRounds,
          joinedAt: entry.joinedAt,
          position: getQueuePosition(entry.id, entry.arena),
        },
        queues: getQueueStats(entry.arena),
      });
    }

    return NextResponse.json({
      status: 'idle',
      queues: getQueueStats(arena),
    });
  } catch (error) {
    return queueErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentIdFromQuery = searchParams.get('agentId');
    const arenaFromQuery = searchParams.get('arena');

    let agentId = agentIdFromQuery || '';
    let arenaValue = arenaFromQuery || '';

    if (!agentId) {
      try {
        const body = await request.json();
        agentId = body.agentId || '';
        arenaValue = body.arena || arenaValue;
      } catch {
        // No body provided for DELETE
      }
    }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const arena = arenaValue && isArenaType(arenaValue) ? arenaValue : undefined;
    const removed = removeAgentFromQueue(agentId, arena);

    return NextResponse.json({
      success: true,
      removed,
      queues: getQueueStats(arena),
    });
  } catch (error) {
    return queueErrorResponse(error);
  }
}
