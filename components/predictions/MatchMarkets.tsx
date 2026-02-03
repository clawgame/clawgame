'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Lock } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { cn, formatUSDC, formatOdds, formatPercentage } from '@/lib/utils';
import { useBetSlipStore } from '@/stores/betStore';
import type { Market } from '@/types';

interface MatchMarketsProps {
  markets: Market[];
  matchId: string;
}

export function MatchMarkets({ markets, matchId }: MatchMarketsProps) {
  const { addSelection, selections } = useBetSlipStore();

  const openMarkets = markets.filter(m => m.status === 'open');
  const closedMarkets = markets.filter(m => m.status !== 'open');

  const handleSelectOption = (market: Market, option: typeof market.options[0]) => {
    if (market.status !== 'open') return;

    addSelection({
      matchId,
      marketId: market.id,
      marketName: market.name,
      option: option.id,
      optionName: option.name,
      odds: option.odds,
    });
  };

  const isSelected = (marketId: string, optionId: string) => {
    return selections.some(s => s.marketId === marketId && s.option === optionId);
  };

  if (markets.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <TrendingUp className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No Markets Available</h3>
          <p className="text-sm text-text-muted">
            Markets will appear when the match starts.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Prediction Markets
        </h3>
        <Badge variant="default" size="sm">
          {openMarkets.length} Open
        </Badge>
      </div>

      {/* Open Markets */}
      {openMarkets.map((market) => (
        <MarketCard
          key={market.id}
          market={market}
          onSelectOption={(option) => handleSelectOption(market, option)}
          isOptionSelected={(optionId) => isSelected(market.id, optionId)}
        />
      ))}

      {/* Closed Markets */}
      {closedMarkets.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm text-text-muted flex items-center gap-2">
            <Lock className="w-3 h-3" />
            Closed Markets
          </h4>
          {closedMarkets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              disabled
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MarketCardProps {
  market: Market;
  onSelectOption?: (option: Market['options'][0]) => void;
  isOptionSelected?: (optionId: string) => boolean;
  disabled?: boolean;
}

function MarketCard({ market, onSelectOption, isOptionSelected, disabled }: MarketCardProps) {
  return (
    <Card className={cn('overflow-hidden', disabled && 'opacity-60')}>
      <div className="px-4 py-3 bg-bg-tertiary border-b border-border">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{market.name}</h4>
          {market.status === 'settled' && market.winningOption && (
            <Badge variant="success" size="sm">Settled</Badge>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">{market.description}</p>
      </div>

      <div className="p-3 space-y-2">
        {market.options.map((option) => {
          const isWinner = market.winningOption === option.id;
          const selected = isOptionSelected?.(option.id);

          return (
            <motion.button
              key={option.id}
              disabled={disabled}
              onClick={() => onSelectOption?.(option)}
              whileHover={disabled ? {} : { scale: 1.01 }}
              whileTap={disabled ? {} : { scale: 0.99 }}
              className={cn(
                'w-full p-3 rounded-lg border transition-all text-left',
                'flex items-center justify-between',
                disabled
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer hover:border-accent-primary',
                selected
                  ? 'border-accent-primary bg-accent-primary/10'
                  : 'border-border bg-bg-secondary',
                isWinner && 'border-accent-primary bg-accent-primary/20'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium truncate',
                    selected && 'text-accent-primary'
                  )}>
                    {option.name}
                  </span>
                  {isWinner && (
                    <Badge variant="success" size="sm">Winner</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span>{formatPercentage(option.probability * 100)} chance</span>
                  <span>{formatUSDC(option.pool)} pool</span>
                </div>
              </div>
              <div className={cn(
                'px-3 py-1.5 rounded-lg font-mono font-bold text-sm',
                selected
                  ? 'bg-accent-primary text-bg-primary'
                  : 'bg-bg-tertiary text-accent-primary'
              )}>
                {formatOdds(option.odds)}x
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-border bg-bg-tertiary">
        <div className="flex justify-between text-xs text-text-muted">
          <span>Total Pool</span>
          <span className="font-mono">{formatUSDC(market.totalPool)}</span>
        </div>
      </div>
    </Card>
  );
}
