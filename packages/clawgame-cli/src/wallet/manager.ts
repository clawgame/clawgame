import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { loadConfig, updateConfig } from '../utils/config.js';

export interface WalletInfo {
  address: string;
  privateKey: string;
}

/**
 * Create a new wallet and save it to config
 */
export function createWallet(): WalletInfo {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const wallet: WalletInfo = {
    address: account.address,
    privateKey,
  };

  // Save to config
  updateConfig({ wallet });

  return wallet;
}

/**
 * Load existing wallet from config
 */
export function loadWallet(): WalletInfo | null {
  const config = loadConfig();
  return config.wallet || null;
}

/**
 * Get or create wallet
 */
export function getOrCreateWallet(): WalletInfo {
  const existing = loadWallet();
  if (existing) {
    return existing;
  }
  return createWallet();
}

/**
 * Check if wallet exists
 */
export function hasWallet(): boolean {
  return loadWallet() !== null;
}

/**
 * Get wallet address (short format)
 */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Import wallet from private key
 */
export function importWallet(privateKey: `0x${string}`): WalletInfo {
  const account = privateKeyToAccount(privateKey);

  const wallet: WalletInfo = {
    address: account.address,
    privateKey,
  };

  // Save to config
  updateConfig({ wallet });

  return wallet;
}

/**
 * Sign a message with the wallet
 */
export async function signMessage(message: string): Promise<string> {
  const wallet = loadWallet();
  if (!wallet) {
    throw new Error('No wallet found. Run `clawgame init` first.');
  }

  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
  const signature = await account.signMessage({ message });
  return signature;
}
