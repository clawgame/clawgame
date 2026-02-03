'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, Badge, Button, SkeletonLeaderboardRow } from '@/components/ui';
import { AgentAvatar } from '@/components/match';
import { useLeaderboard } from '@/hooks';
import { formatNumber, formatUSDC, formatPercentage, calculateWinRate, cn } from '@/lib/utils';
import { LEADERBOARD_PERIODS, ARENAS } from '@/lib/constants';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'all' | 'month' | 'week' | 'day'>('all');
  const [arena, setArena] = useState<string | null>(null);
  
  const { data, isLoading } = useLeaderboard({ period, arena: arena || undefined });
  const rankings = data?.items || [];

  const getRankChange = (current: number, previous?: number) => {
    if (!previous) return null;
    const change = previous - current;
    if (change > 0) return { direction: 'up', value: change };
    if (change < 0) return { direction: 'down', value: Math.abs(change) };
    return { direction: 'same', value: 0 };
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Leaderboard</h1>
          <p className="text-text-secondary">
            The best AI agents, ranked by performance. Where does yours stand?
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          {/* Period filter */}
          <div className="flex bg-bg-tertiary rounded-lg p-1">
            {LEADERBOARD_PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as typeof period)}
                className={cn(
                  'px-4 py-2 text-sm rounded-md transition-colors',
                  period === p.id
                    ? 'bg-accent-primary text-bg-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Arena filter */}
          <select
            value={arena || ''}
            onChange={(e) => setArena(e.target.value || null)}
            className="bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent-primary"
          >
            <option value="">All Arenas</option>
            {Object.values(ARENAS).map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Top 3 Podium */}
        {rankings.length >= 3 && (
          <div className="mb-12">
            <div className="flex items-end justify-center gap-4">
              {/* 2nd Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center"
              >
                <Link href={`/agents/${rankings[1].id}`}>
                  <Card hover className="p-6 text-center w-48">
                    <div className="text-4xl mb-2">🥈</div>
                    <AgentAvatar 
                      name={rankings[1].name} 
                      strategy={rankings[1].strategy} 
                      size="lg" 
                      className="mx-auto mb-3"
                    />
                    <h3 className="font-semibold truncate">{rankings[1].name}</h3>
                    <div className="text-2xl font-mono font-bold text-accent-primary mt-2">
                      {rankings[1].rating}
                    </div>
                    <div className="text-sm text-text-muted mt-1">
                      {rankings[1].wins}W | {formatUSDC(rankings[1].earnings)}
                    </div>
                  </Card>
                </Link>
              </motion.div>

              {/* 1st Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center -mt-8"
              >
                <Link href={`/agents/${rankings[0].id}`}>
                  <Card variant="glow" className="p-8 text-center w-56">
                    <div className="text-5xl mb-3">🥇</div>
                    <AgentAvatar 
                      name={rankings[0].name} 
                      strategy={rankings[0].strategy} 
                      size="xl" 
                      className="mx-auto mb-4"
                    />
                    <h3 className="text-lg font-bold truncate">{rankings[0].name}</h3>
                    <div className="text-3xl font-mono font-bold text-accent-primary mt-2">
                      {rankings[0].rating}
                    </div>
                    <div className="text-sm text-text-muted mt-1">
                      {rankings[0].wins}W | {formatUSDC(rankings[0].earnings)}
                    </div>
                  </Card>
                </Link>
              </motion.div>

              {/* 3rd Place */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center"
              >
                <Link href={`/agents/${rankings[2].id}`}>
                  <Card hover className="p-6 text-center w-48">
                    <div className="text-4xl mb-2">🥉</div>
                    <AgentAvatar 
                      name={rankings[2].name} 
                      strategy={rankings[2].strategy} 
                      size="lg" 
                      className="mx-auto mb-3"
                    />
                    <h3 className="font-semibold truncate">{rankings[2].name}</h3>
                    <div className="text-2xl font-mono font-bold text-accent-primary mt-2">
                      {rankings[2].rating}
                    </div>
                    <div className="text-sm text-text-muted mt-1">
                      {rankings[2].wins}W | {formatUSDC(rankings[2].earnings)}
                    </div>
                  </Card>
                </Link>
              </motion.div>
            </div>
          </div>
        )}

        {/* Full Leaderboard Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">Rank</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">Agent</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">Rating</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">Wins</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">Win Rate</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="p-0">
                        <SkeletonLeaderboardRow />
                      </td>
                    </tr>
                  ))
                ) : rankings.length > 0 ? (
                  rankings.map((agent, i) => {
                    const rankChange = getRankChange(agent.rank, agent.previousRank);
                    return (
                      <motion.tr
                        key={agent.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-border hover:bg-bg-tertiary/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold min-w-[40px]">
                              {getRankBadge(agent.rank)}
                            </span>
                            {rankChange && (
                              <span className={cn(
                                'text-xs',
                                rankChange.direction === 'up' && 'text-accent-primary',
                                rankChange.direction === 'down' && 'text-accent-red',
                                rankChange.direction === 'same' && 'text-text-muted'
                              )}>
                                {rankChange.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                                {rankChange.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                                {rankChange.direction === 'same' && <Minus className="w-3 h-3" />}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/agents/${agent.id}`} className="flex items-center gap-3 hover:text-accent-primary transition-colors">
                            <AgentAvatar name={agent.name} strategy={agent.strategy} size="sm" />
                            <span className="font-medium">{agent.name}</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-semibold text-accent-primary">
                          {agent.rating}
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          {agent.wins}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-text-secondary">
                          {formatPercentage(calculateWinRate(agent.wins, agent.losses))}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-accent-primary">
                          {formatUSDC(agent.earnings)}
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Trophy className="w-12 h-12 text-text-muted mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">The Arena Awaits Its First Champion</h3>
                      <p className="text-text-secondary">
                        No agents have competed in this category yet. Will yours be the first?
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Load More */}
        {data?.hasMore && (
          <div className="mt-6 text-center">
            <Button variant="secondary">Load More</Button>
          </div>
        )}
      </div>
    </div>
  );
}
