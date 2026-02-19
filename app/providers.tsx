'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { WalletModal, AuthSync, ServiceWorkerCleanup } from '@/components/wallet';

function getPrivyAppId(): string {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID environment variable.');
  }

  return appId;
}

const PRIVY_APP_ID = getPrivyAppId();

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#00ff88',
          logo: '/logo.png',
          walletChainType: 'solana-only',
        },
        // Login methods
        loginMethods: ['wallet', 'email'],
        // Solana cluster
        solanaClusters: [{ name: 'mainnet-beta' }],
        // External wallet connectors (Phantom, Solflare, etc.)
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        // Embedded wallets — auto-create for all users on login
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ServiceWorkerCleanup />
        <AuthSync />
        <WalletModal />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            },
          }}
        />
      </QueryClientProvider>
    </PrivyProvider>
  );
}
