'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { WalletModal } from '@/components/wallet';
import { base } from 'viem/chains';

// Privy App ID - should be in env variables in production
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'clawgame-demo';

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
        },
        // Login methods
        loginMethods: ['wallet', 'email'],
        // Default chain
        defaultChain: base,
        // Supported chains
        supportedChains: [base],
        // Embedded wallets
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
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
