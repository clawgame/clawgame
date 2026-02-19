import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatMatch, toPrismaMatchStatus, toPrismaArena, toNumber } from '@/lib/api-utils';
import { ArenaType, MatchStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { verifyAuth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { runPitMatch } from '@/lib/engine/match-engine';
import { runSpeedTradeMatch } from '@/lib/engine/speed-trade-engine';
import { runColosseumMatch } from '@/lib/engine/colosseum-engine';
import { runBazaarMatch } from '@/lib/engine/bazaar-engine';
import { ARENAS } from '@/lib/constants';
import { getPlatformConfig } from '@/lib/platform-config';

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

// ─── POST: Create a new match ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const rateLimited = enforceRateLimit(request, {
      namespace: 'matches:create',
      limit: 8,
      windowMs: 60_000,
      message: 'Rate limit exceeded for match creation. Please wait before creating another match.',
    });
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { agent1Id, agent2Id, arena = 'the-pit', prizePool, maxRounds } = body;

    if (!agent1Id) {
      return NextResponse.json({ error: 'agent1Id is required' }, { status: 400 });
    }
    if (!prizePool || prizePool <= 0) {
      return NextResponse.json({ error: 'prizePool must be positive' }, { status: 400 });
    }

    // Validate arena
    const arenaConfig = ARENAS[arena as keyof typeof ARENAS];
    if (!arenaConfig) {
      return NextResponse.json({ error: `Unknown arena: ${arena}` }, { status: 400 });
    }

    if (prizePool < arenaConfig.minEntry * 2) {
      return NextResponse.json(
        { error: `Minimum prize pool for ${arenaConfig.name} is $${arenaConfig.minEntry * 2}` },
        { status: 400 }
      );
    }

    // Validate agent1
    const agent1 = await prisma.agent.findUnique({ where: { id: agent1Id } });
    if (!agent1 || !agent1.isActive) {
      return NextResponse.json({ error: 'Agent 1 not found or inactive' }, { status: 404 });
    }

    // Check agent1 isn't already in a live match
    const agent1LiveMatch = await prisma.match.findFirst({
      where: {
        status: MatchStatus.LIVE,
        OR: [{ agent1Id }, { agent2Id: agent1Id }],
      },
    });
    if (agent1LiveMatch) {
      return NextResponse.json({ error: 'Agent 1 is already in a live match' }, { status: 400 });
    }

    // Resolve agent2 (provided or matchmake)
    let resolvedAgent2Id = agent2Id;
    if (!resolvedAgent2Id) {
      // Matchmaking: find closest-rated active agent not in a live match
      const liveMatchAgentIds = await prisma.match.findMany({
        where: { status: MatchStatus.LIVE },
        select: { agent1Id: true, agent2Id: true },
      });

      const busyIds = new Set<string>();
      busyIds.add(agent1Id);
      for (const m of liveMatchAgentIds) {
        busyIds.add(m.agent1Id);
        if (m.agent2Id) busyIds.add(m.agent2Id);
      }

      const candidates = await prisma.agent.findMany({
        where: {
          isActive: true,
          id: { notIn: Array.from(busyIds) },
        },
        orderBy: { rating: 'desc' },
      });

      if (candidates.length === 0) {
        return NextResponse.json({ error: 'No available opponents for matchmaking' }, { status: 400 });
      }

      // Pick closest by rating
      candidates.sort((a, b) =>
        Math.abs(a.rating - agent1.rating) - Math.abs(b.rating - agent1.rating)
      );
      resolvedAgent2Id = candidates[0].id;
    }

    // Validate agent2
    const agent2 = await prisma.agent.findUnique({ where: { id: resolvedAgent2Id } });
    if (!agent2 || !agent2.isActive) {
      return NextResponse.json({ error: 'Agent 2 not found or inactive' }, { status: 404 });
    }

    // Map arena string to Prisma enum
    const prismaArena = toPrismaArena(arena);
    if (!prismaArena) {
      return NextResponse.json({ error: 'Invalid arena' }, { status: 400 });
    }

    const resolvedMaxRounds = maxRounds || ('maxRounds' in arenaConfig ? arenaConfig.maxRounds : 10);
    const config = getPlatformConfig();
    const platformFee = prizePool * config.platformFee;
    const entryFee = prizePool / 2;

    // Check both agents have sufficient balance for entry fee
    const [user1, user2] = await Promise.all([
      prisma.user.findUnique({ where: { id: agent1.userId } }),
      prisma.user.findUnique({ where: { id: agent2.userId } }),
    ]);

    if (!user1 || toNumber(user1.balance) < entryFee) {
      return NextResponse.json(
        { error: `Agent 1 has insufficient balance. Required: $${entryFee} USDC. Fund your wallet first.` },
        { status: 400 }
      );
    }
    if (!user2 || toNumber(user2.balance) < entryFee) {
      return NextResponse.json(
        { error: `Opponent has insufficient balance for this match.` },
        { status: 400 }
      );
    }

    // Create match and deduct entry fees atomically
    const match = await prisma.$transaction(async (tx) => {
      // Deduct entry fee from both agents' users
      await tx.user.update({
        where: { id: agent1.userId },
        data: { balance: { decrement: new Decimal(entryFee) } },
      });
      await tx.user.update({
        where: { id: agent2.userId },
        data: { balance: { decrement: new Decimal(entryFee) } },
      });

      // Record MATCH_ENTRY transactions
      await tx.transaction.create({
        data: {
          userId: agent1.userId,
          type: 'MATCH_ENTRY',
          amount: new Decimal(-entryFee),
          balanceBefore: user1.balance,
          balanceAfter: new Decimal(toNumber(user1.balance) - entryFee),
          description: `Entry fee for ${arenaConfig.name} match`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: agent2.userId,
          type: 'MATCH_ENTRY',
          amount: new Decimal(-entryFee),
          balanceBefore: user2.balance,
          balanceAfter: new Decimal(toNumber(user2.balance) - entryFee),
          description: `Entry fee for ${arenaConfig.name} match`,
        },
      });

      // Create the match
      return tx.match.create({
        data: {
          arena: prismaArena,
          status: MatchStatus.PENDING,
          agent1Id,
          agent2Id: resolvedAgent2Id,
          prizePool: new Decimal(prizePool),
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

    // Fire and forget — run the correct arena engine asynchronously
    const engineConfig = {
      matchId: match.id,
      agent1Id,
      agent2Id: resolvedAgent2Id,
      maxRounds: resolvedMaxRounds,
      prizePool,
    };

    const engineError = (err: unknown) => {
      console.error(`[MatchEngine] Error in match ${match.id}:`, err);
    };

    switch (prismaArena) {
      case 'THE_PIT':
        runPitMatch(engineConfig).catch(engineError);
        break;
      case 'SPEED_TRADE':
        runSpeedTradeMatch(engineConfig).catch(engineError);
        break;
      case 'COLOSSEUM':
        runColosseumMatch(engineConfig).catch(engineError);
        break;
      case 'BAZAAR':
        runBazaarMatch(engineConfig).catch(engineError);
        break;
    }

    return NextResponse.json(formatMatch(match), { status: 201 });
  } catch (error) {
    console.error('Error creating match:', error);
    return NextResponse.json(
      { error: 'Failed to create match' },
      { status: 500 }
    );
  }
}
