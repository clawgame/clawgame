import { NextResponse } from 'next/server';

function parseAdminWallets(): Set<string> {
  const raw = process.env.ADMIN_WALLET_ADDRESSES || '';
  const items = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(items);
}

export function isAdminWallet(walletAddress: string | null | undefined): boolean {
  if (!walletAddress) return false;
  const admins = parseAdminWallets();

  // Dev-friendly fallback: if no admin list is configured, allow access.
  if (admins.size === 0) return true;

  return admins.has(walletAddress.toLowerCase());
}

export function requireAdminWallet(walletAddress: string | null | undefined): NextResponse | null {
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
  }

  if (!isAdminWallet(walletAddress)) {
    return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
  }

  return null;
}
