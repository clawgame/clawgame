import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatAgent, generateAvatarColor, toPrismaStrategy } from '@/lib/api-utils';
import { validateStrategyConfig } from '@/lib/engine/custom-strategy';
import { createAgentWallet, getPrivyErrorDetails } from '@/lib/privy-server';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { name, strategy, bio, walletAddress, strategyConfig } = body;

    // Name is always required; walletAddress is optional (CLI may not send one)
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
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
    // If walletAddress provided (frontend), use it; otherwise generate a placeholder
    const userWalletAddress = walletAddress || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    let user = await prisma.user.findUnique({
      where: { walletAddress: userWalletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress: userWalletAddress },
      });
    }

    // Determine strategy and validate custom config
    let prismaStrategy = strategy ? toPrismaStrategy(strategy) : 'BALANCED';
    let validatedConfig: object | null = null;

    if (strategyConfig && typeof strategyConfig === 'object') {
      try {
        validatedConfig = validateStrategyConfig(strategyConfig);
        prismaStrategy = 'CUSTOM';
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Invalid strategy config' },
          { status: 400 }
        );
      }
    }

    // Create Privy Solana wallet for the agent
    let privyWalletId: string | null = null;
    let solanaAddress: string | null = null;

    try {
      const wallet = await createAgentWallet();
      privyWalletId = wallet.id;
      solanaAddress = wallet.address;
    } catch (walletError) {
      console.error('Failed to create agent wallet:', walletError);
      const privyError = getPrivyErrorDetails(walletError);
      return NextResponse.json(
        { error: privyError.message },
        { status: privyError.status }
      );
    }

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name,
        bio: bio || null,
        strategy: prismaStrategy,
        ...(validatedConfig ? { strategyConfig: validatedConfig } : {}),
        avatarColor: generateAvatarColor(),
        privyWalletId,
        solanaAddress,
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
