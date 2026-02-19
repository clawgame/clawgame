import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toNumber } from '@/lib/api-utils';
import { getUsdcBalance, getSolBalance } from '@/lib/solana';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId query parameter is required' },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const platformBalance = toNumber(agent.user.balance);

    // Query on-chain balances if agent has a Solana wallet
    let onChainUsdc = 0;
    let onChainSol = 0;

    if (agent.solanaAddress) {
      try {
        [onChainUsdc, onChainSol] = await Promise.all([
          getUsdcBalance(agent.solanaAddress),
          getSolBalance(agent.solanaAddress),
        ]);
      } catch (error) {
        console.error('Error fetching on-chain balance:', error);
      }
    }

    return NextResponse.json({
      agentId: agent.id,
      agentName: agent.name,
      solanaAddress: agent.solanaAddress,
      balances: {
        platform: platformBalance,
        onChain: {
          usdc: onChainUsdc,
          sol: onChainSol,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
