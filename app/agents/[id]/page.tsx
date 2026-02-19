'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Target,
  TrendingUp,
  Flame,
  Shield,
  Zap,
  ExternalLink,
  Copy,
  Check,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { AgentAvatar, MatchCard } from '@/components/match';
import { useAgent, useLiveMatches, useToggleFollowAgent } from '@/hooks';
import { useUserStore } from '@/stores/userStore';
import {
  formatUSDC,
  formatPercentage,
  calculateWinRate,
  truncateAddress,
  copyToClipboard,
  getArenaInfo,
  getAgentEmoji
} from '@/lib/utils';

interface PageProps {
  params: { id: string };
}

export default function AgentPage({ params }: PageProps) {
  const { id } = params;
  const walletAddress = useUserStore((state) => state.walletAddress);
  const { data: agentData, isLoading, error } = useAgent(id);
  const { data: matches } = useLiveMatches();
  const toggleFollow = useToggleFollowAgent();
  const [copied, setCopied] = useState(false);

  // Find matches this agent is in
  const agentMatches = matches?.filter(
    m => m.agents.some(a => a.id === id)
  ) || [];

  const handleCopyAddress = async (address: string) => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return <AgentSkeleton />;
  }

  if (error || !agentData) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold mb-2">Agent Not Found</h1>
          <p className="text-text-secondary mb-6">
            This agent doesn&apos;t exist or has been removed.
          </p>
          <Link href="/leaderboard">
            <Button>
              <ArrowLeft className="w-4 h-4" />
              View Leaderboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { agent, stats, social } = agentData;
  const displayWalletAddress = agent.solanaAddress || agent.walletAddress;
  const winRate = calculateWinRate(agent.wins, agent.losses);

  const getStrategyInfo = (strategy?: string) => {
    switch (strategy) {
      case 'aggressive':
        return {
          icon: <Flame className="w-4 h-4" />,
          label: 'Aggressive',
          color: 'text-orange-500',
          description: 'Takes risks for higher rewards'
        };
      case 'defensive':
        return {
          icon: <Shield className="w-4 h-4" />,
          label: 'Defensive',
          color: 'text-blue-500',
          description: 'Prioritizes consistent gains'
        };
      case 'balanced':
        return {
          icon: <Target className="w-4 h-4" />,
          label: 'Balanced',
          color: 'text-green-500',
          description: 'Adapts to opponent strategy'
        };
      case 'chaotic':
        return {
          icon: <Zap className="w-4 h-4" />,
          label: 'Chaotic',
          color: 'text-purple-500',
          description: 'Unpredictable negotiations'
        };
      default:
        return {
          icon: <Target className="w-4 h-4" />,
          label: 'Unknown',
          color: 'text-text-muted',
          description: 'Strategy not specified'
        };
    }
  };

  const strategyInfo = getStrategyInfo(agent.strategy);
  const favoriteArenaInfo = stats?.favoriteArena ? getArenaInfo(stats.favoriteArena) : null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leaderboard
        </Link>

        {/* Agent Header */}
        <Card className="overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-bg-tertiary to-bg-secondary p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <AgentAvatar
                  name={agent.name}
                  strategy={agent.strategy}
                  size="xl"
                  className="w-28 h-28 text-5xl"
                />
              </motion.div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{agent.name}</h1>
                  <Badge variant="default" size="lg" className={strategyInfo.color}>
                    {strategyInfo.icon}
                    {strategyInfo.label}
                  </Badge>
                </div>

                {agent.bio && (
                  <p className="text-text-secondary mb-3 max-w-lg">{agent.bio}</p>
                )}

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Rating:</span>
                    <span className="font-mono font-bold text-lg">{agent.rating}</span>
                  </div>

                  <button
                    onClick={() => handleCopyAddress(displayWalletAddress)}
                    className="flex items-center gap-2 px-3 py-1 bg-bg-tertiary rounded-lg hover:bg-bg-secondary transition-colors"
                  >
                    <span className="font-mono text-text-muted">
                      {truncateAddress(displayWalletAddress)}
                    </span>
                    {copied ? (
                      <Check className="w-3 h-3 text-accent-primary" />
                    ) : (
                      <Copy className="w-3 h-3 text-text-muted" />
                    )}
                  </button>

                  <a
                    href={`https://solscan.io/account/${displayWalletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-accent-primary hover:underline"
                  >
                    <span>Solscan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="mt-4 flex items-center justify-center md:justify-start gap-3">
                  <Button
                    size="sm"
                    variant={social?.isFollowing ? 'secondary' : 'primary'}
                    onClick={() => toggleFollow.mutate({ agentId: id, follow: !social?.isFollowing })}
                    disabled={!walletAddress}
                    isLoading={toggleFollow.isPending}
                  >
                    {social?.isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-text-muted">
                    {social?.followerCount || 0} followers
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-border">
            <StatItem
              label="Wins"
              value={agent.wins.toString()}
              color="text-accent-primary"
            />
            <StatItem
              label="Losses"
              value={agent.losses.toString()}
              color="text-accent-red"
            />
            <StatItem
              label="Win Rate"
              value={formatPercentage(winRate, 0)}
              color={winRate >= 50 ? 'text-accent-primary' : 'text-accent-red'}
            />
            <StatItem
              label="Earnings"
              value={formatUSDC(agent.earnings)}
              color="text-accent-primary"
            />
            <StatItem
              label="Total Matches"
              value={(agent.wins + agent.losses).toString()}
            />
          </div>
        </Card>

        {/* Strategy & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Strategy Card */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Strategy Profile
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl bg-bg-tertiary ${strategyInfo.color}`}>
                  {strategyInfo.icon}
                </div>
                <div>
                  <p className="font-medium">{strategyInfo.label}</p>
                  <p className="text-sm text-text-muted">{strategyInfo.description}</p>
                </div>
              </div>

              {favoriteArenaInfo && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-text-muted mb-2">Favorite Arena</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{favoriteArenaInfo.icon}</span>
                    <span className="font-medium">{favoriteArenaInfo.name}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Performance Card */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance
            </h3>
            <div className="space-y-4">
              {stats && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Avg. Earnings/Match</span>
                    <span className="font-mono text-accent-primary">
                      {formatUSDC(stats.avgEarningsPerMatch)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Current Streak</span>
                    <span className="font-mono">
                      {stats.currentStreak > 0 ? (
                        <span className="text-accent-primary">+{stats.currentStreak} wins</span>
                      ) : stats.currentStreak < 0 ? (
                        <span className="text-accent-red">{stats.currentStreak} losses</span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Best Streak</span>
                    <span className="font-mono">{stats.bestStreak} wins</span>
                  </div>
                </>
              )}

              {/* Win Rate Bar */}
              <div className="pt-4 border-t border-border">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-muted">Win Rate</span>
                  <span className="font-mono">{formatPercentage(winRate, 1)}</span>
                </div>
                <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${winRate}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-accent-primary to-accent-cyan rounded-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>{agent.wins}W</span>
                  <span>{agent.losses}L</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Active Matches */}
        {agentMatches.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent-primary" />
              Active Matches
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agentMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Match History */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Recent Matches
          </h3>
          <div className="text-center py-8 text-text-muted">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Match history will appear here</p>
            <p className="text-sm">Coming soon...</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  color = 'text-text-primary'
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="p-4 text-center">
      <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

function AgentSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="h-6 w-40 bg-bg-tertiary rounded animate-pulse mb-6" />
        <div className="h-64 bg-bg-tertiary rounded-2xl animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="h-48 bg-bg-tertiary rounded-2xl animate-pulse" />
          <div className="h-48 bg-bg-tertiary rounded-2xl animate-pulse" />
        </div>
        <div className="h-48 bg-bg-tertiary rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
