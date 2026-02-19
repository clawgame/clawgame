'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Copy, Check, ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { toast } from 'sonner';
import { useUserStore } from '@/stores/userStore';
import { truncateAddress, formatUSDC, copyToClipboard } from '@/lib/utils';
import { Button } from '@/components/ui';

export function WalletPopup() {
  const { balance, walletAddress, activeAgentId, setBalance } = useUserStore();
  const { logout } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { wallets: solanaWallets } = useSolanaWallets();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Prefer embedded Solana wallet, fall back to any connected Solana wallet (Phantom, etc.)
  const embeddedWallet = solanaWallets.find((w) => w.walletClientType === 'privy');
  const displayAddress = embeddedWallet?.address || solanaWallets[0]?.address || walletAddress;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleCopy = async () => {
    if (!displayAddress) return;
    const success = await copyToClipboard(displayAddress);
    if (success) {
      setCopied(true);
      toast.success('Wallet address copied');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy wallet address');
    }
  };

  const handleSyncDeposit = async () => {
    if (isSyncing || !displayAddress) return;
    setIsSyncing(true);
    try {
      let targetAgentId = activeAgentId;

      if (!targetAgentId) {
        const agentsRes = await fetch(`/api/agents?walletAddress=${displayAddress}`);
        const agentsData = await agentsRes.json();
        const agents = agentsData.items || [];
        targetAgentId = agents[0]?.id;
      }

      if (!targetAgentId) {
        toast.error('No agent found for this wallet');
        setIsSyncing(false);
        return;
      }

      // Try to sync deposit (credits on-chain USDC to platform balance)
      const depositRes = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: targetAgentId }),
      });
      const depositData = await depositRes.json();

      if (depositData.newPlatformBalance != null) {
        setBalance(depositData.newPlatformBalance);
        toast.success(`Deposit synced: ${formatUSDC(depositData.deposited || 0)}`);
      } else {
        // Refresh balance even if no deposit
        const balRes = await fetch(`/api/wallet/balance?agentId=${targetAgentId}`);
        const balData = await balRes.json();
        if (balData?.balances?.platform != null) {
          setBalance(balData.balances.platform);
          toast.info('No new deposit found to sync');
        }
      }
    } catch {
      toast.error('Deposit sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      setIsOpen(false);
      toast.success('Disconnected wallet');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  const handleFundWallet = async () => {
    if (!displayAddress || isFunding) return;
    setIsFunding(true);
    try {
      await fundWallet(displayAddress);
    } catch {
      toast.error('Unable to open on-ramp flow');
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <div ref={popupRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-bg-tertiary border border-border hover:border-accent-primary transition-all duration-200 cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
          <Wallet className="w-3.5 h-3.5 text-bg-primary" />
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold font-mono text-accent-primary leading-tight">
            {formatUSDC(balance)}
          </div>
          <div className="text-[10px] text-text-muted leading-tight">
            {displayAddress ? truncateAddress(displayAddress, 4) : 'Loading...'}
          </div>
        </div>
      </button>

      {/* Dropdown popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-bg-card border border-border shadow-xl overflow-hidden z-50"
          >
            {/* Balance section */}
            <div className="p-4 bg-gradient-to-br from-bg-card to-bg-tertiary border-b border-border">
              <p className="text-xs text-text-muted mb-1">Platform Balance</p>
              <p className="text-2xl font-bold text-accent-primary font-mono">
                {formatUSDC(balance)}
              </p>
            </div>

            {/* Wallet address */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs text-text-muted mb-1.5">Solana Wallet</p>
              {displayAddress ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-text-secondary truncate">
                    {displayAddress}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors text-text-muted hover:text-text-primary shrink-0"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-accent-primary" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-text-muted">Creating wallet...</p>
              )}
            </div>

            {/* Deposit section */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs text-text-muted mb-2">Deposit USDC</p>
              <p className="text-xs text-text-secondary mb-3">
                Send USDC (Solana) to your wallet address above, then sync.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleSyncDeposit}
                isLoading={isSyncing}
                disabled={!displayAddress}
              >
                {!isSyncing && <RefreshCw className="w-3.5 h-3.5" />}
                Sync Deposit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2"
                onClick={handleFundWallet}
                isLoading={isFunding}
                disabled={!displayAddress}
              >
                Buy USDC
              </Button>
            </div>

            {/* Actions */}
            <div className="p-2">
              {displayAddress && (
                <a
                  href={`https://solscan.io/account/${displayAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Solscan
                </a>
              )}
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent-red hover:bg-accent-red/10 transition-colors w-full text-left"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
