import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

async function resolveUser(walletAddress: string) {
  return prisma.user.upsert({
    where: { walletAddress },
    create: { walletAddress },
    update: {},
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        follows: {
          include: {
            followingAgent: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        items: [],
        total: 0,
      });
    }

    return NextResponse.json({
      items: user.follows.map((follow) => ({
        id: follow.followingAgent.id,
        name: follow.followingAgent.name,
        rating: follow.followingAgent.rating,
        strategy: follow.followingAgent.strategy.toLowerCase(),
        avatarColor: follow.followingAgent.avatarColor,
        followedAt: follow.createdAt.toISOString(),
      })),
      total: user.follows.length,
    });
  } catch (error) {
    console.error('Error fetching follows:', error);
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : null;
    const agentId = typeof body.agentId === 'string' ? body.agentId : null;

    if (!walletAddress || !agentId) {
      return NextResponse.json({ error: 'walletAddress and agentId are required' }, { status: 400 });
    }

    const [user, agent] = await Promise.all([
      resolveUser(walletAddress),
      prisma.agent.findUnique({ where: { id: agentId } }),
    ]);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    await prisma.agentFollow.upsert({
      where: {
        followerUserId_followingAgentId: {
          followerUserId: user.id,
          followingAgentId: agentId,
        },
      },
      create: {
        followerUserId: user.id,
        followingAgentId: agentId,
      },
      update: {},
    });

    const followerCount = await prisma.agentFollow.count({
      where: { followingAgentId: agentId },
    });

    return NextResponse.json({
      success: true,
      followerCount,
      isFollowing: true,
    });
  } catch (error) {
    console.error('Error following agent:', error);
    return NextResponse.json({ error: 'Failed to follow agent' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const agentId = searchParams.get('agentId');

    if (!walletAddress || !agentId) {
      return NextResponse.json({ error: 'walletAddress and agentId are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      return NextResponse.json({ success: true, followerCount: 0, isFollowing: false });
    }

    await prisma.agentFollow.deleteMany({
      where: {
        followerUserId: user.id,
        followingAgentId: agentId,
      },
    });

    const followerCount = await prisma.agentFollow.count({
      where: { followingAgentId: agentId },
    });

    return NextResponse.json({
      success: true,
      followerCount,
      isFollowing: false,
    });
  } catch (error) {
    console.error('Error unfollowing agent:', error);
    return NextResponse.json({ error: 'Failed to unfollow agent' }, { status: 500 });
  }
}
