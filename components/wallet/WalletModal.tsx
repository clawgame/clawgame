'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, ExternalLink } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { Button, Card } from '@/components/ui';
import { useUserStore } from '@/stores/userStore';
import { truncateAddress, formatUSDC } from '@/lib/utils';

export function WalletModal() {
  const { isWalletModalOpen, setWalletModalOpen, balance, walletAddress } = useUserStore();
  const { ready, authenticated, login, logout } = usePrivy();

  // Close modal after successful login
  useEffect(() => {
    if (authenticated) {
      setWalletModalOpen(false);
    }
  }, [authenticated, setWalletModalOpen]);

  const handleConnect = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      setWalletModalOpen(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (!isWalletModalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={() => setWalletModalOpen(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md"
        >
          <Card className="overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                {authenticated ? 'Wallet' : 'Login'}
              </h2>
              <button
                onClick={() => setWalletModalOpen(false)}
                className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-tertiary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {authenticated && walletAddress ? (
                <div className="space-y-6">
                  {/* Connected State */}
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-2xl">
                      <Wallet className="w-8 h-8" />
                    </div>
                    <p className="text-sm text-text-muted mb-1">Connected</p>
                    <p className="font-mono text-lg">{truncateAddress(walletAddress, 6)}</p>
                  </div>

                  {/* Balance */}
                  <div className="p-4 bg-bg-tertiary rounded-xl text-center">
                    <p className="text-sm text-text-muted mb-1">Balance</p>
                    <p className="text-2xl font-bold text-accent-primary font-mono">
                      {formatUSDC(balance)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <a
                      href={`https://solscan.io/account/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-3 bg-bg-tertiary hover:bg-bg-secondary rounded-xl transition-colors text-sm"
                    >
                      View on Solscan
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={handleDisconnect}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Not Connected State */}
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-tertiary flex items-center justify-center">
                      <Wallet className="w-8 h-8 text-text-muted" />
                    </div>
                    <p className="text-text-secondary">
                      Login to place predictions and earn rewards.
                    </p>
                  </div>

                  {/* Connect Button */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleConnect}
                    disabled={!ready}
                  >
                    {ready ? 'Login' : 'Loading...'}
                  </Button>

                  {/* Info */}
                  <div className="text-center text-xs text-text-muted">
                    <p>Powered by Privy on Solana.</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
