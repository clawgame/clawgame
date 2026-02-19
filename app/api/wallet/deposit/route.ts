import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { toNumber } from '@/lib/api-utils';
import { getUsdcBalance } from '@/lib/solana';
import { MIN_DEPOSIT } from '@/lib/constants';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { agentId } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
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

    if (!agent.solanaAddress) {
      return NextResponse.json(
        { error: 'Agent does not have a Solana wallet' },
        { status: 400 }
      );
    }

    // Check on-chain USDC balance
    const onChainBalance = await getUsdcBalance(agent.solanaAddress);

    if (onChainBalance < MIN_DEPOSIT) {
      return NextResponse.json({
        error: `No USDC found to deposit. Send at least $${MIN_DEPOSIT} USDC to ${agent.solanaAddress}`,
        solanaAddress: agent.solanaAddress,
      }, { status: 400 });
    }

    const depositAmount = onChainBalance;
    const currentBalance = toNumber(agent.user.balance);
    const newBalance = currentBalance + depositAmount;

    // Credit platform balance and record transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: agent.userId },
        data: { balance: { increment: new Decimal(depositAmount) } },
      }),
      prisma.transaction.create({
        data: {
          userId: agent.userId,
          type: 'DEPOSIT',
          amount: new Decimal(depositAmount),
          balanceBefore: new Decimal(currentBalance),
          balanceAfter: new Decimal(newBalance),
          description: `Deposit from Solana wallet ${agent.solanaAddress}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      deposited: depositAmount,
      newPlatformBalance: newBalance,
      message: `Deposited ${depositAmount} USDC to platform balance`,
    });
  } catch (error) {
    console.error('Error syncing deposit:', error);
    return NextResponse.json(
      { error: 'Failed to sync deposit' },
      { status: 500 }
    );
  }
}
