/**
 * Solana RPC helpers for USDC balance queries and transaction building.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { SOLANA_RPC_URL, SOLANA_USDC_MINT } from './constants';

const USDC_DECIMALS = 6;

// Lazy-init connection (avoid creating at import time in serverless)
let _connection: Connection | null = null;
function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  }
  return _connection;
}

function getUsdcMint(): PublicKey {
  return new PublicKey(SOLANA_USDC_MINT);
}

// ─── Balance Queries ─────────────────────────────────────────────────────────

/**
 * Get USDC-SPL balance for a Solana address.
 * @returns Balance in human-readable USDC (e.g., 100.50)
 */
export async function getUsdcBalance(address: string): Promise<number> {
  try {
    const connection = getConnection();
    const publicKey = new PublicKey(address);
    const ata = await getAssociatedTokenAddress(getUsdcMint(), publicKey);
    const balance = await connection.getTokenAccountBalance(ata);
    return balance.value.uiAmount ?? 0;
  } catch {
    // Token account doesn't exist → 0 balance
    return 0;
  }
}

/**
 * Get native SOL balance for a Solana address.
 * @returns Balance in SOL
 */
export async function getSolBalance(address: string): Promise<number> {
  try {
    const connection = getConnection();
    const publicKey = new PublicKey(address);
    const lamports = await connection.getBalance(publicKey);
    return lamports / 1e9;
  } catch {
    return 0;
  }
}

// ─── Transaction Builders ────────────────────────────────────────────────────

/**
 * Build a USDC-SPL transfer transaction (unsigned).
 * Returns base64-encoded transaction for Privy to sign.
 *
 * @param fromAddress Sender's Solana address (the agent wallet)
 * @param toAddress Recipient's Solana address
 * @param amount Amount in USDC (e.g., 10.5 for $10.50)
 */
export async function buildUsdcTransfer(
  fromAddress: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const connection = getConnection();
  const fromPubkey = new PublicKey(fromAddress);
  const toPubkey = new PublicKey(toAddress);
  const usdcMint = getUsdcMint();

  const fromAta = await getAssociatedTokenAddress(usdcMint, fromPubkey);
  const toAta = await getAssociatedTokenAddress(usdcMint, toPubkey);

  const rawAmount = Math.floor(amount * Math.pow(10, USDC_DECIMALS));

  const transaction = new Transaction();

  // Create recipient's ATA if it doesn't exist
  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        toAta,
        toPubkey,
        usdcMint
      )
    );
  }

  // Add USDC transfer instruction
  transaction.add(
    createTransferCheckedInstruction(
      fromAta,
      usdcMint,
      toAta,
      fromPubkey,
      rawAmount,
      USDC_DECIMALS
    )
  );

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  // Serialize unsigned for Privy to sign
  const serialized = transaction.serialize({ requireAllSignatures: false });
  return Buffer.from(serialized).toString('base64');
}
