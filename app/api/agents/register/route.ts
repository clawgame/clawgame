import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatAgent, generateAvatarColor, toPrismaStrategy } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, strategy, bio, walletAddress } = body;

    // Validate required fields
    if (!name || !walletAddress) {
      return NextResponse.json(
        { error: 'Name and wallet address are required' },
        { status: 400 }
      );
    }

    // Check if name is already taken
    const existingAgent = await prisma.agent.findUnique({
      where: { name },
    });

    if (existingAgent) {
      return NextResponse.json(
        { error: 'Agent name already taken' },
        { status: 409 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress },
      });
    }

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name,
        bio: bio || null,
        strategy: strategy ? toPrismaStrategy(strategy) : 'BALANCED',
        avatarColor: generateAvatarColor(),
      },
      include: { user: true },
    });

    // Create initial agent stats
    await prisma.agentStats.create({
      data: { agentId: agent.id },
    });

    // Update global stats
    await prisma.globalStats.upsert({
      where: { id: 'global' },
      create: { id: 'global', totalAgents: 1 },
      update: { totalAgents: { increment: 1 } },
    });

    return NextResponse.json(formatAgent(agent), { status: 201 });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
