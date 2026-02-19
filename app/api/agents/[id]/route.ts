import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatAgent, formatMatch, toNumber } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const { id } = params;

    // Get agent with stats and user
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        user: true,
        agentStats: true,
        _count: {
          select: { followers: true },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get recent matches
    const recentMatches = await prisma.match.findMany({
      where: {
        OR: [
          { agent1Id: id },
          { agent2Id: id },
        ],
        status: 'COMPLETED',
      },
      include: {
        agent1: { include: { user: true } },
        agent2: { include: { user: true } },
      },
      orderBy: { endedAt: 'desc' },
      take: 5,
    });

    // Calculate stats
    const totalMatches = agent.wins + agent.losses + agent.draws;
    const winRate = totalMatches > 0
      ? Math.round((agent.wins / totalMatches) * 100)
      : 0;
    const avgEarningsPerMatch = totalMatches > 0
      ? toNumber(agent.earnings) / totalMatches
      : 0;

    // Determine favorite arena based on stats
    let favoriteArena = 'the-pit';
    if (agent.agentStats) {
      const arenaStats = [
        { arena: 'the-pit', matches: agent.agentStats.pitWins + agent.agentStats.pitLosses },
        { arena: 'colosseum', matches: agent.agentStats.colosseumWins + agent.agentStats.colosseumLosses },
        { arena: 'speed-trade', matches: agent.agentStats.speedTradeWins + agent.agentStats.speedTradeLosses },
      ];
      const mostPlayed = arenaStats.reduce((a, b) => a.matches > b.matches ? a : b);
      if (mostPlayed.matches > 0) {
        favoriteArena = mostPlayed.arena;
      }
    }

    let isFollowing = false;
    if (walletAddress) {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        select: { id: true },
      });
      if (user) {
        const follow = await prisma.agentFollow.findUnique({
          where: {
            followerUserId_followingAgentId: {
              followerUserId: user.id,
              followingAgentId: id,
            },
          },
          select: { id: true },
        });
        isFollowing = !!follow;
      }
    }

    return NextResponse.json({
      agent: formatAgent(agent),
      stats: {
        totalMatches,
        winRate,
        avgEarningsPerMatch: Math.round(avgEarningsPerMatch * 100) / 100,
        bestStreak: agent.agentStats?.longestWinStreak || 0,
        currentStreak: agent.agentStats?.currentWinStreak || 0,
        favoriteArena,
      },
      social: {
        followerCount: agent._count.followers,
        isFollowing,
      },
      recentMatches: recentMatches.map(formatMatch),
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}
