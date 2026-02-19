/**
 * Privy Server-Side API Client
 * Creates and manages Solana wallets for agents via Privy's server wallet infrastructure.
 */

import { getAgenticPrivyCredentials } from '@/lib/privy-config';

const PRIVY_API_BASE = 'https://api.privy.io';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrivyWallet {
  id: string;
  address: string;
  chain_type: string;
  policy_ids: string[];
  created_at: number;
}

interface PrivyPolicy {
  id: string;
  name: string;
  chain_type: string;
  version: string;
  rules: unknown[];
  created_at: number;
}

interface PrivyRpcResponse {
  method: string;
  data: {
    hash?: string;     // EVM tx hash
    signature?: string; // Solana tx signature
    caip2?: string;
  };
}

export interface PrivyErrorDetails {
  status: number;
  message: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function getPrivyHeaders(): Record<string, string> {
  const { appId, appSecret } = getAgenticPrivyCredentials();

  const authToken = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  return {
    'Authorization': `Basic ${authToken}`,
    'privy-app-id': appId,
    'Content-Type': 'application/json',
  };
}

export function getPrivyErrorDetails(error: unknown): PrivyErrorDetails {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes('Invalid app ID or app secret') || raw.includes('401')) {
    return {
      status: 500,
      message: 'Agentic Privy credentials are invalid. Check AGENTIC_PRIVY_APP_ID/AGENTIC_PRIVY_APP_SECRET (or PRIVY_APP_ID/PRIVY_APP_SECRET).',
    };
  }

  if (raw.includes('Missing agentic Privy credentials')) {
    return {
      status: 500,
      message: 'Agentic Privy credentials are missing. Set AGENTIC_PRIVY_APP_ID/AGENTIC_PRIVY_APP_SECRET (or PRIVY_APP_ID/PRIVY_APP_SECRET).',
    };
  }

  if (raw.includes('Failed to create Privy policy')) {
    return {
      status: 502,
      message: 'Privy policy setup failed. Verify your Privy app configuration and server credentials.',
    };
  }

  if (raw.includes('Failed to create Privy wallet')) {
    return {
      status: 502,
      message: 'Privy wallet creation failed. Verify your Privy app wallet settings and try again.',
    };
  }

  if (raw.includes('Privy RPC error')) {
    return {
      status: 502,
      message: 'Privy transaction signing failed. Please retry and verify policy permissions.',
    };
  }

  return {
    status: 500,
    message: 'Privy request failed. Please verify server credentials and wallet policy configuration.',
  };
}

// ─── Policy (cached — one policy for all agent wallets) ──────────────────────

let cachedPolicyId: string | null = null;

/**
 * Get or create the platform-wide agent wallet policy.
 * Caches the policy ID so we only create it once per server lifecycle.
 */
export async function getOrCreateAgentPolicy(): Promise<string> {
  if (cachedPolicyId) return cachedPolicyId;

  const headers = getPrivyHeaders();

  const response = await fetch(`${PRIVY_API_BASE}/v1/policies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      version: '1.0',
      name: 'ClawGame Solana Guardrails',
      chain_type: 'solana',
      rules: [
        {
          // Limit to SPL token transfers with a 10k USDC max per tx (6 decimals).
          name: 'Allow TransferChecked <= 10k USDC',
          method: 'signAndSendTransaction',
          conditions: [
            {
              field_source: 'solana_token_program_instruction',
              field: 'instructionName',
              operator: 'eq',
              value: 'TransferChecked',
            },
            {
              field_source: 'solana_token_program_instruction',
              field: 'TransferChecked.amount',
              operator: 'lte',
              value: '10000000000',
            },
          ],
          action: 'ALLOW',
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Privy policy: ${response.status} ${errorText}`);
  }

  const policy: PrivyPolicy = await response.json();
  cachedPolicyId = policy.id;
  return policy.id;
}

// ─── Wallet Creation ─────────────────────────────────────────────────────────

/**
 * Create a new Solana wallet for an agent via Privy.
 */
export async function createAgentWallet(): Promise<PrivyWallet> {
  const policyId = await getOrCreateAgentPolicy();
  const headers = getPrivyHeaders();

  const response = await fetch(`${PRIVY_API_BASE}/v1/wallets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chain_type: 'solana',
      policy_ids: [policyId],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Privy wallet: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// ─── Wallet Retrieval ────────────────────────────────────────────────────────

export async function getWallet(walletId: string): Promise<PrivyWallet> {
  const headers = getPrivyHeaders();

  const response = await fetch(`${PRIVY_API_BASE}/v1/wallets/${walletId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get wallet: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// ─── Transaction Signing ─────────────────────────────────────────────────────

/**
 * Sign and send a Solana transaction using a Privy-managed wallet.
 * @param walletId Privy wallet ID
 * @param transactionBase64 Base64-encoded unsigned Solana transaction
 * @returns Transaction signature
 */
export async function signAndSendTransaction(
  walletId: string,
  transactionBase64: string
): Promise<string> {
  const headers = getPrivyHeaders();

  const response = await fetch(`${PRIVY_API_BASE}/v1/wallets/${walletId}/rpc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      method: 'signAndSendTransaction',
      caip2: 'solana:mainnet',
      params: {
        transaction: transactionBase64,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Privy RPC error: ${response.status} ${errorText}`);
  }

  const result: PrivyRpcResponse = await response.json();
  const signature = result.data.signature || result.data.hash;

  if (!signature) {
    throw new Error('No transaction signature returned from Privy');
  }

  return signature;
}
