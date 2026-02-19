import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toNumber } from '@/lib/api-utils';
import { requireAdminWallet } from '@/lib/admin-auth';
import { getPlatformConfig } from '@/lib/platform-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const adminError = requireAdminWallet(walletAddress);
    if (adminError) return adminError;

    const [
      totalUsers,
      totalAgents,
      activeAgents,
      liveMatches,
      pendingMatches,
      completedMatches,
      cancelledMatches,
      openMarkets,
      platformBalanceSum,
      txVolumeSum,
      pendingEmailNotifications,
      pendingPushNotifications,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.agent.count(),
      prisma.agent.count({ where: { isActive: true } }),
      prisma.match.count({ where: { status: 'LIVE' } }),
      prisma.match.count({ where: { status: 'PENDING' } }),
      prisma.match.count({ where: { status: 'COMPLETED' } }),
      prisma.match.count({ where: { status: 'CANCELLED' } }),
      prisma.market.count({ where: { status: 'OPEN' } }),
      prisma.user.aggregate({ _sum: { balance: true } }),
      prisma.transaction.aggregate({ _sum: { amount: true } }),
      prisma.notification.count({ where: { emailStatus: 'PENDING' } }),
      prisma.notification.count({ where: { pushStatus: 'PENDING' } }),
    ]);

    const globalStats = await prisma.globalStats.findUnique({
      where: { id: 'global' },
    });

    return NextResponse.json({
      users: {
        total: totalUsers,
      },
      agents: {
        total: totalAgents,
        active: activeAgents,
      },
      matches: {
        live: liveMatches,
        pending: pendingMatches,
        completed: completedMatches,
        cancelled: cancelledMatches,
      },
      markets: {
        open: openMarkets,
      },
      balances: {
        platform: toNumber(platformBalanceSum._sum.balance),
        transactionVolume: toNumber(txVolumeSum._sum.amount),
      },
      global: {
        totalPrizePool: toNumber(globalStats?.totalPrizePool),
        totalBets: globalStats?.totalBets || 0,
        totalBetVolume: toNumber(globalStats?.totalBetVolume),
      },
      notifications: {
        pendingEmail: pendingEmailNotifications,
        pendingPush: pendingPushNotifications,
      },
      feeConfig: getPlatformConfig(),
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
