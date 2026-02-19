'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Bot, Crosshair, History, LineChart, Wallet } from 'lucide-react';
import { Badge, Button, Card, SkeletonMatchCard } from '@/components/ui';
import { MatchCard } from '@/components/match';
import { useMyAgents, useUserBets } from '@/hooks';
import { useUserStore } from '@/stores/userStore';
import * as api from '@/lib/api';
import { formatUSDC, formatPercentage } from '@/lib/utils';

export default function DashboardPage() {
  const { isAuthenticated, walletAddress, balance, setWalletModalOpen } = useUserStore();
  const { data: agents = [], isLoading: agentsLoading } = useMyAgents(walletAddress);
  const { data: bets, isLoading: betsLoading } = useUserBets();

  const agentIds = useMemo(() => new Set(agents.map((agent) => agent.id)), [agents]);
  const agentIdList = useMemo(() => Array.from(agentIds), [agentIds]);

  const { data: activeMatches = [], isLoading: activeMatchesLoading } = useQuery({
    queryKey: ['dashboard', 'active-matches', agentIdList],
    queryFn: async () => {
      const response = await api.getMatches({ status: 'live', limit: 50 });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch live matches');
      }

      return response.data.items.filter((match) =>
        match.agents.some((agent) => agentIds.has(agent.id))
      );
    },
    enabled: isAuthenticated && agents.length > 0,
  });

  const { data: recentMatches = [], isLoading: recentMatchesLoading } = useQuery({
    queryKey: ['dashboard', 'recent-matches', agentIdList],
    queryFn: async () => {
      const response = await api.getMatches({ status: 'completed', limit: 60 });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch recent matches');
      }

      return response.data.items
        .filter((match) => match.agents.some((agent) => agentIds.has(agent.id)))
        .slice(0, 6);
    },
    enabled: isAuthenticated && agents.length > 0,
  });

  const { data: analyticsMatches = [], isLoading: analyticsMatchesLoading } = useQuery({
    queryKey: ['dashboard', 'analytics-matches', agentIdList],
    queryFn: async () => {
      const response = await api.getMatches({ status: 'completed', limit: 200 });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch analytics matches');
      }

      return response.data.items.filter((match) =>
        match.agents.some((agent) => agentIds.has(agent.id))
      );
    },
    enabled: isAuthenticated && agents.length > 0,
  });

  const agentTotals = useMemo(() => {
    const totalWins = agents.reduce((sum, agent) => sum + agent.wins, 0);
    const totalLosses = agents.reduce((sum, agent) => sum + agent.losses, 0);
    const totalMatches = totalWins + totalLosses;
    const totalEarnings = agents.reduce((sum, agent) => sum + agent.earnings, 0);
    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

    return {
      totalWins,
      totalLosses,
      totalMatches,
      totalEarnings,
      winRate,
    };
  }, [agents]);

  const wonPayout = useMemo(
    () => bets?.settled.filter((bet) => bet.status === 'won').reduce((sum, bet) => sum + bet.potentialWinnings, 0) || 0,
    [bets]
  );

  const strategyAnalytics = useMemo(() => {
    const grouped = new Map<string, { agents: number; wins: number; losses: number; earnings: number }>();

    for (const agent of agents) {
      const key = (agent.strategy || 'balanced').toLowerCase();
      const existing = grouped.get(key) || { agents: 0, wins: 0, losses: 0, earnings: 0 };
      grouped.set(key, {
        agents: existing.agents + 1,
        wins: existing.wins + agent.wins,
        losses: existing.losses + agent.losses,
        earnings: existing.earnings + agent.earnings,
      });
    }

    return Array.from(grouped.entries())
      .map(([strategy, stats]) => {
        const total = stats.wins + stats.losses;
        return {
          strategy,
          ...stats,
          winRate: total > 0 ? (stats.wins / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.winRate - a.winRate);
  }, [agents]);

  const opponentAnalytics = useMemo(() => {
    const rows = new Map<string, { name: string; matches: number; wins: number; losses: number }>();

    for (const match of analyticsMatches) {
      const myAgent = match.agents.find((agent) => agentIds.has(agent.id));
      if (!myAgent) continue;

      const opponent = match.agents.find((agent) => agent.id !== myAgent.id);
      if (!opponent) continue;

      const existing = rows.get(opponent.id) || {
        name: opponent.name,
        matches: 0,
        wins: 0,
        losses: 0,
      };

      const didWin = match.winner === myAgent.id;
      const didLose = !!match.winner && match.winner !== myAgent.id;

      rows.set(opponent.id, {
        name: opponent.name,
        matches: existing.matches + 1,
        wins: existing.wins + (didWin ? 1 : 0),
        losses: existing.losses + (didLose ? 1 : 0),
      });
    }

    return Array.from(rows.values())
      .map((entry) => ({
        ...entry,
        winRate: entry.matches > 0 ? (entry.wins / entry.matches) * 100 : 0,
      }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 8);
  }, [analyticsMatches, agentIds]);

  const earningsSeries = useMemo(() => {
    const days = 14;
    const now = new Date();
    const labels: string[] = [];
    const valuesByDay = new Map<string, number>();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(now.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      labels.push(key);
      valuesByDay.set(key, 0);
    }

    for (const match of analyticsMatches) {
      const myAgent = match.agents.find((agent) => agentIds.has(agent.id));
      if (!myAgent) continue;

      const endDate = match.endedAt || match.startedAt;
      if (!endDate) continue;

      const key = new Date(endDate).toISOString().slice(0, 10);
      if (!valuesByDay.has(key)) continue;

      let delta = 0;
      if (match.winner === myAgent.id) {
        delta = match.prizePool / 2;
      } else if (match.winner && match.winner !== myAgent.id) {
        delta = -match.prizePool / 2;
      }

      valuesByDay.set(key, (valuesByDay.get(key) || 0) + delta);
    }

    const daily = labels.map((label) => valuesByDay.get(label) || 0);
    const cumulative: number[] = [];
    let running = 0;
    for (const value of daily) {
      running += value;
      cumulative.push(running);
    }

    return {
      labels,
      daily,
      cumulative,
      total: daily.reduce((sum, value) => sum + value, 0),
    };
  }, [analyticsMatches, agentIds]);

  if (!isAuthenticated) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h1 className="text-3xl font-bold mb-3">Agent Dashboard</h1>
            <p className="text-text-secondary mb-6">
              Login to view your agents, active battles, bets, and earnings in one place.
            </p>
            <Button onClick={() => setWalletModalOpen(true)}>
              Login to Continue
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-text-secondary">
            Monitor your agents, open positions, and performance across the arena.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Platform Balance</div>
            <div className="text-xl font-bold text-accent-primary">{formatUSDC(balance)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Your Agents</div>
            <div className="text-xl font-bold">{agents.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Active Matches</div>
            <div className="text-xl font-bold">{activeMatches.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Open Bets</div>
            <div className="text-xl font-bold">{bets?.active.length || 0}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <LineChart className="w-5 h-5 text-accent-primary" />
              <h2 className="text-lg font-semibold">Performance Snapshot</h2>
            </div>

            {agentsLoading ? (
              <div className="text-sm text-text-muted">Loading performance...</div>
            ) : agents.length === 0 ? (
              <div className="text-sm text-text-muted">
                No agents found for this wallet yet.{' '}
                <Link href="/agents/create" className="text-accent-primary hover:underline">
                  Create one now.
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Stat label="Wins" value={String(agentTotals.totalWins)} />
                  <Stat label="Losses" value={String(agentTotals.totalLosses)} />
                  <Stat label="Win Rate" value={formatPercentage(agentTotals.winRate, 1)} />
                  <Stat label="Earnings" value={formatUSDC(agentTotals.totalEarnings)} />
                </div>

                <div>
                  <div className="text-sm text-text-muted mb-3">Earnings by agent</div>
                  <div className="space-y-2">
                    {agents.map((agent) => {
                      const width = agentTotals.totalEarnings > 0
                        ? Math.max(6, (agent.earnings / agentTotals.totalEarnings) * 100)
                        : 6;

                      return (
                        <Link
                          key={agent.id}
                          href={`/agents/${agent.id}`}
                          className="block hover:opacity-90 transition-opacity"
                        >
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium">{agent.name}</span>
                            <span className="text-accent-primary font-semibold">
                              {formatUSDC(agent.earnings)}
                            </span>
                          </div>
                          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent-primary to-accent-cyan rounded-full"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-accent-primary" />
              <h2 className="text-lg font-semibold">Betting Summary</h2>
            </div>

            {betsLoading ? (
              <div className="text-sm text-text-muted">Loading bets...</div>
            ) : (
              <div className="space-y-3">
                <MiniStat label="Open Bets" value={String(bets?.active.length || 0)} />
                <MiniStat label="Settled Bets" value={String(bets?.settled.length || 0)} />
                <MiniStat label="Won Payout" value={formatUSDC(wonPayout)} />
                <MiniStat label="Total Winnings" value={formatUSDC(bets?.totalWinnings || 0)} />
              </div>
            )}

            <div className="mt-5 space-y-2">
              <Link href="/predictions">
                <Button variant="secondary" className="w-full justify-start">
                  <Crosshair className="w-4 h-4" />
                  Open Predictions
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="secondary" className="w-full justify-start">
                  <History className="w-4 h-4" />
                  Match History
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-accent-primary" />
                <h2 className="text-lg font-semibold">Your Agents</h2>
              </div>
              {agents.length > 0 && <Badge variant="info">{agents.length}</Badge>}
            </div>

            {agentsLoading ? (
              <div className="text-sm text-text-muted">Loading agents...</div>
            ) : agents.length === 0 ? (
              <div className="text-sm text-text-muted">
                No agents yet.{' '}
                <Link href="/agents/create" className="text-accent-primary hover:underline">
                  Open agent builder.
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <Link key={agent.id} href={`/agents/${agent.id}`} className="block">
                    <div className="p-3 rounded-xl border border-border hover:border-accent-primary transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{agent.name}</p>
                          <p className="text-xs text-text-muted">
                            Rating {agent.rating} · {agent.wins}W/{agent.losses}L
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-accent-primary">
                          {formatUSDC(agent.earnings)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent-primary" />
                <h2 className="text-lg font-semibold">Matches</h2>
              </div>
              <Badge variant="default">{activeMatches.length} live</Badge>
            </div>

            {activeMatchesLoading ? (
              <div className="space-y-3">
                <SkeletonMatchCard />
              </div>
            ) : activeMatches.length > 0 ? (
              <div className="space-y-3">
                {activeMatches.slice(0, 2).map((match) => (
                  <MatchCard key={match.id} match={match} variant="compact" />
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-muted mb-4">No active matches right now.</div>
            )}

            <div className="mt-5">
              <div className="text-sm font-semibold mb-3">Recent completed</div>
              {recentMatchesLoading ? (
                <div className="text-sm text-text-muted">Loading recent matches...</div>
              ) : recentMatches.length === 0 ? (
                <div className="text-sm text-text-muted">No completed matches found for your agents.</div>
              ) : (
                <div className="space-y-2">
                  {recentMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/match/${match.id}`}
                      className="block p-2 rounded-lg border border-border hover:border-accent-primary transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          {match.agents[0].name} vs {match.agents[1].name}
                        </span>
                        <span className="text-text-muted">{formatUSDC(match.prizePool)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Win Rate by Strategy</h2>
              <Badge variant="default">{strategyAnalytics.length}</Badge>
            </div>
            {agentsLoading ? (
              <div className="text-sm text-text-muted">Loading strategy analytics...</div>
            ) : strategyAnalytics.length === 0 ? (
              <div className="text-sm text-text-muted">No strategy data yet.</div>
            ) : (
              <div className="space-y-2">
                {strategyAnalytics.map((row) => (
                  <div key={row.strategy} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium capitalize">{row.strategy}</span>
                      <span className="text-accent-primary font-semibold">{formatPercentage(row.winRate, 1)}</span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {row.wins}W/{row.losses}L · {row.agents} agent{row.agents === 1 ? '' : 's'} · {formatUSDC(row.earnings)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Opponent Analysis</h2>
              <Badge variant="default">{opponentAnalytics.length}</Badge>
            </div>
            {analyticsMatchesLoading ? (
              <div className="text-sm text-text-muted">Loading opponent data...</div>
            ) : opponentAnalytics.length === 0 ? (
              <div className="text-sm text-text-muted">No completed match data yet.</div>
            ) : (
              <div className="space-y-2">
                {opponentAnalytics.map((row) => (
                  <div key={row.name} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-accent-primary font-semibold">{formatPercentage(row.winRate, 1)}</span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {row.matches} matches · {row.wins} wins · {row.losses} losses
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Earnings Trend (14d)</h2>
              <span className={`text-sm font-semibold ${earningsSeries.total >= 0 ? 'text-accent-primary' : 'text-accent-red'}`}>
                {earningsSeries.total >= 0 ? '+' : ''}{formatUSDC(earningsSeries.total)}
              </span>
            </div>
            {analyticsMatchesLoading ? (
              <div className="text-sm text-text-muted">Loading trend data...</div>
            ) : (
              <EarningsSparkline values={earningsSeries.cumulative} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-tertiary p-3">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function EarningsSparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="text-sm text-text-muted">No trend data available.</div>;
  }

  const width = 280;
  const height = 120;
  const padding = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  const path = values
    .map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * drawableWidth;
      const y = height - padding - ((value - min) / span) * drawableHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" role="img" aria-label="Earnings over time">
        <rect x={0} y={0} width={width} height={height} rx={12} fill="hsl(var(--bg-tertiary) / 0.6)" />
        <path d={path} fill="none" stroke="hsl(var(--accent-primary) / 0.95)" strokeWidth={3} strokeLinecap="round" />
      </svg>
      <div className="mt-2 text-xs text-text-muted">
        Cumulative net from completed matches over the last 14 days.
      </div>
    </div>
  );
}
