import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { toNumber } from '@/lib/api-utils';
import { signAndSendTransaction, getPrivyErrorDetails } from '@/lib/privy-server';
import { buildUsdcTransfer } from '@/lib/solana';
import { verifyAuth } from '@/lib/auth';
import { getPlatformConfig } from '@/lib/platform-config';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const config = getPlatformConfig();
    const body = await request.json();
    const { agentId, amount, destinationAddress } = body;

    if (!agentId || !amount || !destinationAddress) {
      return NextResponse.json(
        { error: 'agentId, amount, and destinationAddress are required' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount < config.minWithdrawal) {
      return NextResponse.json(
        { error: `Minimum withdrawal is $${config.minWithdrawal} USDC` },
        { status: 400 }
      );
    }

    if (amount > config.maxWithdrawal) {
      return NextResponse.json(
        { error: `Maximum withdrawal is $${config.maxWithdrawal} USDC` },
        { status: 400 }
      );
    }

    // Validate Solana address format (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destinationAddress)) {
      return NextResponse.json(
        { error: 'Invalid Solana address' },
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

    if (!agent.privyWalletId || !agent.solanaAddress) {
      return NextResponse.json(
        { error: 'Agent does not have a wallet' },
        { status: 400 }
      );
    }

    const currentBalance = toNumber(agent.user.balance);
    if (currentBalance < amount) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: $${currentBalance.toFixed(2)} USDC` },
        { status: 400 }
      );
    }

    // Build USDC transfer transaction
    let transactionBase64: string;
    try {
      transactionBase64 = await buildUsdcTransfer(
        agent.solanaAddress,
        destinationAddress,
        amount
      );
    } catch (error) {
      console.error('Error building USDC transfer:', error);
      return NextResponse.json(
        { error: 'Failed to build withdrawal transaction' },
        { status: 500 }
      );
    }

    // Sign and send via Privy
    let txSignature: string;
    try {
      txSignature = await signAndSendTransaction(
        agent.privyWalletId,
        transactionBase64
      );
    } catch (error) {
      console.error('Error signing withdrawal:', error);
      const privyError = getPrivyErrorDetails(error);
      return NextResponse.json(
        { error: privyError.message },
        { status: privyError.status }
      );
    }

    const newBalance = currentBalance - amount;

    // Deduct platform balance and record transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: agent.userId },
        data: { balance: { decrement: new Decimal(amount) } },
      }),
      prisma.transaction.create({
        data: {
          userId: agent.userId,
          type: 'WITHDRAWAL',
          amount: new Decimal(-amount),
          balanceBefore: new Decimal(currentBalance),
          balanceAfter: new Decimal(newBalance),
          txHash: txSignature,
          description: `Withdrawal to ${destinationAddress}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      amount,
      destination: destinationAddress,
      txSignature,
      explorerUrl: `https://solscan.io/tx/${txSignature}`,
      newBalance,
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}
