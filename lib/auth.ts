import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { getAuthPrivyCredentials } from '@/lib/privy-config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthResult {
  userId: string;
  walletAddress?: string;
}

// ─── Privy Client ────────────────────────────────────────────────────────────

const globalForPrivy = globalThis as unknown as {
  privyClient: PrivyClient | undefined;
};

function getPrivyClient(): PrivyClient {
  if (globalForPrivy.privyClient) return globalForPrivy.privyClient;

  const { appId, appSecret } = getAuthPrivyCredentials();

  const client = new PrivyClient(appId, appSecret);

  if (process.env.NODE_ENV !== 'production') {
    globalForPrivy.privyClient = client;
  }

  return client;
}

// ─── Auth Verification ───────────────────────────────────────────────────────

/**
 * Verify authentication from a request.
 *
 * Advisory auth: if no Authorization header is present, the request proceeds
 * (supports unauthenticated CLI access). If a token IS present, it must be valid.
 *
 * Returns AuthResult on success, null if no auth header, or NextResponse on failure.
 */
export async function verifyAuth(
  request: NextRequest
): Promise<AuthResult | null | NextResponse> {
  const authHeader = request.headers.get('Authorization');

  // No auth header — allow through (advisory mode for CLI)
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });
  }

  try {
    const privy = getPrivyClient();
    const verifiedClaims = await privy.verifyAuthToken(token);

    return {
      userId: verifiedClaims.userId,
    };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
