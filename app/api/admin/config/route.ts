import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWallet } from '@/lib/admin-auth';
import { getPlatformConfig, updatePlatformConfig } from '@/lib/platform-config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');
  const adminError = requireAdminWallet(walletAddress);
  if (adminError) return adminError;

  return NextResponse.json({
    config: getPlatformConfig(),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : null;
    const adminError = requireAdminWallet(walletAddress);
    if (adminError) return adminError;

    const toNumber = (value: unknown): number | undefined => {
      if (value == null || value === '') return undefined;
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return undefined;
      return parsed;
    };

    const updated = updatePlatformConfig({
      platformFee: toNumber(body.platformFee),
      predictionRake: toNumber(body.predictionRake),
      minWithdrawal: toNumber(body.minWithdrawal),
      maxWithdrawal: toNumber(body.maxWithdrawal),
    });

    return NextResponse.json({
      config: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update admin config';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
