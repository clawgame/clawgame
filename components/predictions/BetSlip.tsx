'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { cn, formatUSDC, formatOdds } from '@/lib/utils';
import { useBetSlipStore } from '@/stores/betStore';
import { useUserStore } from '@/stores/userStore';
import { usePlaceBet } from '@/hooks';

export function BetSlip() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    selections,
    stakes,
    isProcessing,
    error,
    removeSelection,
    clearSelections,
    setStake,
    getTotalStake,
    getPotentialWinnings,
  } = useBetSlipStore();

  const { balance, isAuthenticated } = useUserStore();
  const placeBet = usePlaceBet();

  const totalStake = getTotalStake();
  const potentialWinnings = getPotentialWinnings();
  const hasInsufficientBalance = totalStake > balance;
  const hasValidStakes = selections.every(s => (stakes[s.marketId] || 0) > 0);

  const handlePlaceBets = async () => {
    if (!isAuthenticated) {
      // TODO: Trigger wallet connect modal
      return;
    }

    for (const selection of selections) {
      const stake = stakes[selection.marketId];
      if (stake > 0) {
        await placeBet.mutateAsync({
          matchId: selection.matchId,
          marketId: selection.marketId,
          option: selection.option,
          stake,
        });
      }
    }
  };

  if (selections.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none"
    >
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <Card className="overflow-hidden shadow-2xl border-accent-primary/30">
          {/* Header */}
          <div
            className="px-4 py-3 bg-bg-tertiary border-b border-border flex items-center justify-between cursor-pointer"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Bet Slip</h3>
              <Badge variant="default" size="sm">
                {selections.length} {selections.length === 1 ? 'bet' : 'bets'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelections();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              {isCollapsed ? (
                <ChevronUp className="w-5 h-5 text-text-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-text-muted" />
              )}
            </div>
          </div>

          {/* Content */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-[300px] overflow-y-auto">
                  {selections.map((selection) => (
                    <div
                      key={selection.marketId}
                      className="px-4 py-3 border-b border-border last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {selection.optionName}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {selection.marketName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-bg-tertiary rounded text-accent-primary font-mono text-sm font-bold">
                            {formatOdds(selection.odds)}x
                          </span>
                          <button
                            onClick={() => removeSelection(selection.marketId)}
                            className="p-1 text-text-muted hover:text-accent-red transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Stake Input */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={stakes[selection.marketId] || ''}
                            onChange={(e) => setStake(selection.marketId, Number(e.target.value) || 0)}
                            className={cn(
                              'w-full px-3 py-2 bg-bg-secondary border rounded-lg',
                              'text-sm font-mono text-right pr-16',
                              'focus:outline-none focus:border-accent-primary',
                              'placeholder:text-text-muted',
                              hasInsufficientBalance && stakes[selection.marketId] > 0
                                ? 'border-accent-red'
                                : 'border-border'
                            )}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                            USDC
                          </span>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <p className="text-xs text-text-muted">Potential</p>
                          <p className="text-sm font-mono text-accent-primary">
                            {formatUSDC((stakes[selection.marketId] || 0) * selection.odds)}
                          </p>
                        </div>
                      </div>

                      {/* Quick stake buttons */}
                      <div className="mt-2 flex gap-1">
                        {[5, 10, 25, 50].map((amount) => (
                          <button
                            key={amount}
                            onClick={() => setStake(selection.marketId, amount)}
                            className="px-2 py-1 text-xs bg-bg-tertiary hover:bg-bg-secondary border border-border rounded transition-colors"
                          >
                            +{amount}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Error */}
                {error && (
                  <div className="px-4 py-2 bg-accent-red/10 border-t border-accent-red/30">
                    <p className="text-sm text-accent-red flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-4 bg-bg-tertiary border-t border-border space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Total Stake</span>
                    <span className={cn(
                      'font-mono font-semibold',
                      hasInsufficientBalance ? 'text-accent-red' : 'text-text-primary'
                    )}>
                      {formatUSDC(totalStake)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Potential Winnings</span>
                    <span className="font-mono font-semibold text-accent-primary">
                      {formatUSDC(potentialWinnings)}
                    </span>
                  </div>

                  {hasInsufficientBalance && (
                    <p className="text-xs text-accent-red">
                      Insufficient balance. You have {formatUSDC(balance)}.
                    </p>
                  )}

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!hasValidStakes || hasInsufficientBalance || isProcessing}
                    isLoading={isProcessing}
                    onClick={handlePlaceBets}
                  >
                    {!isAuthenticated
                      ? 'Connect Wallet to Bet'
                      : !hasValidStakes
                      ? 'Enter Stake Amounts'
                      : `Place ${selections.length} ${selections.length === 1 ? 'Bet' : 'Bets'}`}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </motion.div>
  );
}
