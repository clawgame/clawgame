import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminWallet } from '@/lib/admin-auth';
import { Decimal } from '@prisma/client/runtime/library';
import { toNumber } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const adminError = requireAdminWallet(walletAddress);
    if (adminError) return adminError;

    const search = searchParams.get('search')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where = search
      ? {
          walletAddress: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : undefined;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: {
            select: {
              agents: true,
              bets: true,
              transactions: true,
              notifications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      items: users.map((user) => ({
        id: user.id,
        walletAddress: user.walletAddress,
        balance: toNumber(user.balance),
        createdAt: user.createdAt.toISOString(),
        counts: user._count,
      })),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : null;
    const adminError = requireAdminWallet(walletAddress);
    if (adminError) return adminError;

    const userId = typeof body.userId === 'string' ? body.userId : null;
    const amount = typeof body.amount === 'number' ? body.amount : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!userId || amount == null || Number.isNaN(amount) || amount === 0) {
      return NextResponse.json({ error: 'userId and non-zero numeric amount are required' }, { status: 400 });
    }

    if (Math.abs(amount) > 100000) {
      return NextResponse.json({ error: 'Adjustment amount exceeds allowed limit' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const before = toNumber(user.balance);
    const after = before + amount;

    if (after < 0) {
      return NextResponse.json({ error: 'Adjustment would make balance negative' }, { status: 400 });
    }

    const type = amount >= 0 ? 'DEPOSIT' : 'WITHDRAWAL';
    const description = reason
      ? `Admin adjustment: ${reason}`
      : 'Admin balance adjustment';

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: new Decimal(amount) },
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type,
          amount: new Decimal(amount),
          balanceBefore: new Decimal(before),
          balanceAfter: new Decimal(after),
          description,
        },
      }),
    ]);

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        walletAddress: updatedUser.walletAddress,
        balance: toNumber(updatedUser.balance),
      },
    });
  } catch (error) {
    console.error('Error adjusting user balance:', error);
    return NextResponse.json({ error: 'Failed to adjust user balance' }, { status: 500 });
  }
}
