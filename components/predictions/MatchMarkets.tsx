'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Lock } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { cn, formatUSDC, formatOdds, formatPercentage } from '@/lib/utils';
import { useBetSlipStore } from '@/stores/betStore';
import { useMatchStore, type OddsHistoryPoint } from '@/stores/matchStore';
import type { Market } from '@/types';

interface MatchMarketsProps {
  markets: Market[];
  matchId: string;
}

export function MatchMarkets({ markets, matchId }: MatchMarketsProps) {
  const { addSelection, selections } = useBetSlipStore();
  const oddsHistory = useMatchStore((state) => state.oddsHistory);

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
          historyByOption={oddsHistory[market.id]}
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
              historyByOption={oddsHistory[market.id]}
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
  historyByOption?: Record<string, OddsHistoryPoint[]>;
  onSelectOption?: (option: Market['options'][0]) => void;
  isOptionSelected?: (optionId: string) => boolean;
  disabled?: boolean;
}

function MarketCard({ market, historyByOption, onSelectOption, isOptionSelected, disabled }: MarketCardProps) {
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

      <OddsTrendChart market={market} historyByOption={historyByOption} />

      <div className="px-4 py-2 border-t border-border bg-bg-tertiary">
        <div className="flex justify-between text-xs text-text-muted">
          <span>Total Pool</span>
          <span className="font-mono">{formatUSDC(market.totalPool)}</span>
        </div>
      </div>
    </Card>
  );
}

const CHART_COLORS = [
  'hsl(var(--accent-primary) / 0.95)',
  'hsl(var(--accent-green) / 0.95)',
  'hsl(var(--accent-purple) / 0.95)',
  'hsl(var(--accent-yellow) / 0.95)',
];

interface OddsTrendChartProps {
  market: Market;
  historyByOption?: Record<string, OddsHistoryPoint[]>;
}

function OddsTrendChart({ market, historyByOption }: OddsTrendChartProps) {
  const width = 260;
  const height = 72;
  const padding = 8;
  const series = market.options.map((option, index) => {
    const rawPoints = (historyByOption?.[option.id] || []).slice(-20);
    const points = rawPoints.length > 0
      ? rawPoints
      : [{ timestamp: market.createdAt, odds: option.odds, pool: option.pool }];

    return {
      option,
      color: CHART_COLORS[index % CHART_COLORS.length],
      points,
    };
  });

  const allOdds = series.flatMap((entry) => entry.points.map((point) => point.odds));
  if (allOdds.length === 0) return null;

  const min = Math.min(...allOdds);
  const max = Math.max(...allOdds);
  const span = max - min || 1;
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  const toPath = (points: OddsHistoryPoint[]) => {
    if (points.length === 1) {
      const y = height - padding - ((points[0].odds - min) / span) * drawableHeight;
      return `M ${padding} ${y} L ${width - padding} ${y}`;
    }

    return points
      .map((point, index) => {
        const x = padding + (index / (points.length - 1)) * drawableWidth;
        const y = height - padding - ((point.odds - min) / span) * drawableHeight;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <div className="px-4 py-3 border-t border-border bg-bg-secondary/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wide text-text-muted">Odds Trend</span>
        <span className="text-[11px] text-text-muted">Live updates</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[72px]"
        role="img"
        aria-label={`${market.name} odds trend`}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={8}
          fill="hsl(var(--bg-tertiary) / 0.6)"
        />
        {series.map((entry) => (
          <path
            key={entry.option.id}
            d={toPath(entry.points)}
            fill="none"
            stroke={entry.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="mt-2 grid gap-1">
        {series.map((entry) => {
          const first = entry.points[0]?.odds || entry.option.odds;
          const last = entry.points[entry.points.length - 1]?.odds || entry.option.odds;
          const delta = last - first;
          const deltaLabel = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);

          return (
            <div key={`${entry.option.id}-legend`} className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-2 text-text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.option.name}
              </span>
              <span className={cn(delta >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                {deltaLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
