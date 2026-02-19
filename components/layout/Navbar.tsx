'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Copy, Check, RefreshCw, ExternalLink, LogOut, Bell, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { toast } from 'sonner';
import { useMyAgents, useNotifications } from '@/hooks';
import { cn, truncateAddress, formatUSDC, copyToClipboard } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants';
import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui';
import { WalletPopup } from '@/components/wallet';

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const { logout } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { wallets: solanaWallets } = useSolanaWallets();
  const {
    isAuthenticated,
    walletAddress,
    balance,
    activeAgentId,
    setActiveAgentId,
    setWalletModalOpen,
  } = useUserStore();
  const setBalance = useUserStore((state) => state.setBalance);
  const { data: myAgents = [] } = useMyAgents(walletAddress);
  const { data: notifications } = useNotifications({ limit: 1 });
  const selectedAgentId = activeAgentId || myAgents[0]?.id || null;
  const unreadNotificationCount = notifications?.unreadCount || 0;

  const embeddedWallet = solanaWallets.find((wallet) => wallet.walletClientType === 'privy');
  const displayAddress = embeddedWallet?.address || solanaWallets[0]?.address || walletAddress;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isAuthenticated || myAgents.length === 0) {
      return;
    }

    if (!selectedAgentId || !myAgents.some((agent) => agent.id === selectedAgentId)) {
      setActiveAgentId(myAgents[0].id);
    }
  }, [isAuthenticated, myAgents, selectedAgentId, setActiveAgentId]);

  const handleCopy = async () => {
    if (!displayAddress) return;
    const success = await copyToClipboard(displayAddress);
    if (!success) {
      toast.error('Failed to copy wallet address');
      return;
    }

    setCopied(true);
    toast.success('Wallet address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncDeposit = async () => {
    if (isSyncing || !displayAddress) return;
    setIsSyncing(true);
    try {
      let targetAgentId = selectedAgentId;

      if (!targetAgentId) {
        const agentsRes = await fetch(`/api/agents?walletAddress=${displayAddress}`);
        const agentsData = await agentsRes.json();
        const agents = agentsData.items || [];
        targetAgentId = agents[0]?.id;
      }

      if (!targetAgentId) {
        toast.error('No agent found for this wallet');
        return;
      }

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
      toast.success('Disconnected wallet');
      setIsMobileMenuOpen(false);
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
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-bg-primary/80 backdrop-blur-xl border-b border-border" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-primary/70 to-transparent" />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 lg:gap-4 h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="relative h-11 w-11 rounded-2xl bg-bg-elevated border border-accent-primary/40 overflow-hidden shadow-glow-green">
              <Image
                src="/logoclaw.jpg"
                alt="ClawGame logo"
                fill
                sizes="44px"
                className="object-contain p-1"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-accent-secondary/25" />
            </div>
            <span className="max-[420px]:hidden text-xl xl:text-2xl font-bold font-display tracking-[0.05em] uppercase whitespace-nowrap">
              Claw<span className="text-gradient">Game</span>
            </span>
            <span className="min-[421px]:hidden text-base font-bold font-display tracking-[0.08em] uppercase text-gradient">
              CG
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex flex-1 min-w-0 justify-center">
            <div className="flex items-center gap-4 xl:gap-6 px-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative text-[11px] xl:text-xs font-semibold tracking-wide uppercase transition-colors whitespace-nowrap',
                      isActive ? 'text-accent-secondary' : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side - Wallet Popup / Login */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0 ml-auto">
            {isAuthenticated ? (
              <>
                <Link
                  href="/notifications"
                  className="relative p-2 rounded-lg border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-accent-primary text-[10px] font-semibold text-white flex items-center justify-center">
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </span>
                      )}
                </Link>
                {myAgents.length > 1 && (
                  <select
                    value={selectedAgentId || ''}
                    onChange={(event) => setActiveAgentId(event.target.value)}
                    className="w-36 xl:w-40 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent-primary"
                    aria-label="Active agent"
                  >
                    {myAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                )}
                <WalletPopup />
              </>
            ) : (
              <Button onClick={() => setWalletModalOpen(true)}>
                <Sparkles className="w-4 h-4" />
                Login
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 text-text-secondary hover:text-text-primary ml-auto"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-panel"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close mobile menu overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 top-16 bg-black/55 backdrop-blur-[1px] lg:hidden"
            />

            <motion.div
              id="mobile-nav-panel"
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="fixed top-16 left-0 right-0 max-h-[calc(100vh-4rem)] overflow-y-auto lg:hidden bg-bg-secondary/95 border-b border-border shadow-2xl"
            >
              <div className="px-4 py-4 space-y-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'block px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent-primary/10 text-accent-primary'
                          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {item.label}
                        {item.href === '/notifications' && unreadNotificationCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-primary text-bg-primary">
                            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}

                <div className="pt-4 border-t border-border">
                  {isAuthenticated ? (
                    <div className="px-4 py-2 space-y-3">
                      {myAgents.length > 1 && (
                        <div>
                          <p className="text-xs text-text-muted mb-1">Active agent</p>
                          <select
                            value={selectedAgentId || ''}
                            onChange={(event) => setActiveAgentId(event.target.value)}
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent-primary"
                          >
                            {myAgents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <div className="text-sm font-mono text-accent-primary">
                          {formatUSDC(balance)}
                        </div>
                        <div className="text-xs text-text-muted">
                          {truncateAddress(displayAddress || '', 4)}
                        </div>
                      </div>

                      {displayAddress && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopy}
                            className="flex-1 text-left text-xs font-mono px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary truncate"
                          >
                            {truncateAddress(displayAddress, 6)}
                          </button>
                          <button
                            onClick={handleCopy}
                            className="p-2 rounded-lg bg-bg-tertiary text-text-secondary"
                            title="Copy address"
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-accent-primary" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleSyncDeposit}
                          isLoading={isSyncing}
                          disabled={!displayAddress}
                          className="w-full"
                        >
                          {!isSyncing && <RefreshCw className="w-3.5 h-3.5" />}
                          Sync
                        </Button>

                        {displayAddress ? (
                          <a
                            href={`https://solscan.io/account/${displayAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-bg-tertiary border border-border text-text-secondary"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Solscan
                          </a>
                        ) : (
                          <Button size="sm" variant="secondary" disabled className="w-full">
                            Solscan
                          </Button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleFundWallet}
                        isLoading={isFunding}
                        disabled={!displayAddress}
                        className="w-full"
                      >
                        Buy USDC
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full"
                        onClick={handleDisconnect}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => {
                        setWalletModalOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      Login
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
