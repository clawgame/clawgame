'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { useUserStore } from '@/stores/userStore';

/**
 * Invisible component that syncs Privy auth state → Zustand store.
 * Must be rendered at all times (not gated behind modal visibility).
 *
 * - Sets isAuthenticated from Privy's authenticated flag
 * - Reads the user's Solana wallet address (embedded or external)
 * - Fetches platform balance for the wallet
 *
 * useSolanaWallets() returns both embedded and external Solana wallets
 * when toSolanaWalletConnectors() is configured in the PrivyProvider.
 *
 * NOTE: Wallet creation is handled by Privy's `createOnLogin: 'all-users'`
 * config — we do NOT call createWallet() here to avoid walletProxy errors.
 */
export function AuthSync() {
  const { ready, authenticated } = usePrivy();
  const { wallets: solanaWallets, ready: solanaReady } = useSolanaWallets();
  const { setAuthenticated, setWalletAddress, setBalance } = useUserStore();
  const lastFetchedAddressRef = useRef<string | null>(null);

  const fetchBalance = useCallback((address: string) => {
    fetch(`/api/agents?walletAddress=${address}`)
      .then((res) => res.json())
      .then((data) => {
        const agents = data.items || [];
        if (agents.length > 0) {
          return fetch(`/api/wallet/balance?agentId=${agents[0].id}`);
        }
        return null;
      })
      .then((res) => res?.json())
      .then((data) => {
        if (data?.balances?.platform != null) {
          setBalance(data.balances.platform);
        }
      })
      .catch(() => {
        // Fallback: balance stays at 0
      });
  }, [setBalance]);

  // Sync auth state
  useEffect(() => {
    if (!ready) return;

    if (authenticated) {
      setAuthenticated(true);
      return;
    } else {
      setAuthenticated(false);
      setWalletAddress(null);
      setBalance(0);
      lastFetchedAddressRef.current = null;
    }
  }, [ready, authenticated, setAuthenticated, setWalletAddress, setBalance]);

  // Sync Solana wallet address once wallets are available
  useEffect(() => {
    if (!ready || !solanaReady || !authenticated) return;

    // Prefer the Privy embedded wallet, fall back to any external Solana wallet (Phantom, etc.)
    const embeddedWallet = solanaWallets.find(
      (w) => w.walletClientType === 'privy'
    );
    const wallet = embeddedWallet || solanaWallets[0];

    if (!wallet) return;
    if (wallet.address === lastFetchedAddressRef.current) return;

    lastFetchedAddressRef.current = wallet.address;
    setWalletAddress(wallet.address);
    fetchBalance(wallet.address);
  }, [ready, solanaReady, authenticated, solanaWallets, setWalletAddress, fetchBalance]);

  return null;
}
