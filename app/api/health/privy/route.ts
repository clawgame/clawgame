import { NextResponse } from 'next/server';
import { getAgenticPrivyCredentials, getPrivyConfigDiagnostics } from '@/lib/privy-config';

const PRIVY_API_BASE = 'https://api.privy.io';

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 240);
}

async function checkAgenticApiReachability(): Promise<{ reachable: boolean; error?: string }> {
  try {
    const { appId, appSecret } = getAgenticPrivyCredentials();
    const authToken = Buffer.from(`${appId}:${appSecret}`).toString('base64');

    const response = await fetch(`${PRIVY_API_BASE}/v1/wallets?limit=1`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authToken}`,
        'privy-app-id': appId,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        reachable: false,
        error: `Agentic Privy API check failed: ${response.status} ${body.slice(0, 160)}`,
      };
    }

    return { reachable: true };
  } catch (error) {
    return {
      reachable: false,
      error: sanitizeErrorMessage(error),
    };
  }
}

export async function GET() {
  const diagnostics = getPrivyConfigDiagnostics();

  const agenticApi = diagnostics.agentic.configured
    ? await checkAgenticApiReachability()
    : { reachable: false, error: 'Agentic credentials are not fully configured.' };

  const ready =
    diagnostics.auth.configured &&
    diagnostics.agentic.configured &&
    agenticApi.reachable;

  return NextResponse.json(
    {
      ready,
      auth: diagnostics.auth,
      agentic: {
        ...diagnostics.agentic,
        apiReachable: agenticApi.reachable,
        apiError: agenticApi.error || null,
      },
      warnings: diagnostics.warnings,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 }
  );
}
