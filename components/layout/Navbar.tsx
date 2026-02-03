'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Wallet } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, truncateAddress, formatUSDC } from '@/lib/utils';
import { NAV_ITEMS, APP_NAME } from '@/lib/constants';
import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui';

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, walletAddress, balance, setWalletModalOpen } = useUserStore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-bg-primary/80 backdrop-blur-xl border-b border-border" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-xl shadow-glow-green group-hover:shadow-glow-green-lg transition-shadow">
                ⚔️
              </div>
              <div className="absolute -inset-1 bg-accent-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Claw<span className="text-accent-primary">Game</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative text-sm font-medium transition-colors',
                    isActive ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent-primary rounded-full"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side - Wallet / Connect */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-mono text-accent-primary">
                    {formatUSDC(balance)}
                  </div>
                  <div className="text-xs text-text-muted">
                    {truncateAddress(walletAddress || '')}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setWalletModalOpen(true)}>
                  <Wallet className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => setWalletModalOpen(true)}>
                Connect Wallet
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-bg-secondary border-b border-border"
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
                    {item.label}
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-border">
                {isAuthenticated ? (
                  <div className="px-4 py-2">
                    <div className="text-sm font-mono text-accent-primary">
                      {formatUSDC(balance)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {truncateAddress(walletAddress || '')}
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setWalletModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Connect Wallet
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
