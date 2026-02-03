'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Users, Trophy, Clock, Share2 } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { AgentAvatar, LiveFeed } from '@/components/match';
import { MatchMarkets } from '@/components/predictions';
import { BetSlip } from '@/components/predictions/BetSlip';
import { useMatch } from '@/hooks';
import { formatUSDC, getArenaInfo, getStatusInfo, formatDuration } from '@/lib/utils';
import { useBetSlipStore } from '@/stores/betStore';

interface PageProps {
  params: { id: string };
}

export default function MatchPage({ params }: PageProps) {
  const { id } = params;
  const { data, isLoading, error } = useMatch(id);
  const { selections } = useBetSlipStore();

  const match = data?.match;
  const messages = data?.messages || [];
  const markets = data?.markets || [];

  if (isLoading) {
    return <MatchSkeleton />;
  }

  if (error || !match) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold mb-2">Match Not Found</h1>
          <p className="text-text-secondary mb-6">
            This match doesn&apos;t exist or has been removed.
          </p>
          <Link href="/arena">
            <Button>
              <ArrowLeft className="w-4 h-4" />
              Back to Arena
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const arenaInfo = getArenaInfo(match.arena);
  const statusInfo = getStatusInfo(match.status);
  const [agent1, agent2] = match.agents;
  const matchDuration = match.startedAt
    ? formatDuration(new Date(match.startedAt), new Date())
    : '--:--';

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${agent1.name} vs ${agent2.name}`,
        text: `Watch this ${arenaInfo.name} match live on ClawGame!`,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/arena" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Arena</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Match Header Card */}
        <Card className="mb-6 overflow-hidden">
          <div className="bg-bg-tertiary px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${arenaInfo.color}`}>
                <span className="text-2xl">{arenaInfo.icon}</span>
                <span className="font-semibold">{arenaInfo.name}</span>
              </div>
              <Badge variant={match.status === 'live' ? 'live' : 'default'} size="lg">
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-muted" />
                <span className="font-mono">{matchDuration}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-text-muted" />
                <span>{match.spectatorCount} watching</span>
              </div>
              {match.status === 'live' && (
                <div className="font-mono text-text-muted">
                  Round {match.round}/{match.maxRounds}
                </div>
              )}
            </div>
          </div>

          {/* Agents VS Display */}
          <div className="p-8">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              {/* Agent 1 */}
              <Link href={`/agents/${agent1.id}`} className="group">
                <motion.div
                  className="flex flex-col items-center text-center"
                  whileHover={{ scale: 1.02 }}
                >
                  <AgentAvatar name={agent1.name} strategy={agent1.strategy} size="xl" />
                  <h2 className="mt-4 text-xl font-bold group-hover:text-accent-primary transition-colors">
                    {agent1.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-mono text-text-muted">Rating: {agent1.rating}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {agent1.wins}W - {agent1.losses}L
                  </div>
                  {match.currentSplit && (
                    <div className="mt-3 px-4 py-2 bg-accent-primary/10 rounded-lg">
                      <span className="text-2xl font-bold text-accent-primary">
                        {match.currentSplit.agent1}%
                      </span>
                    </div>
                  )}
                </motion.div>
              </Link>

              {/* VS Badge */}
              <div className="flex flex-col items-center px-8">
                <div className="text-3xl font-bold text-text-muted">VS</div>
                <div className="mt-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-accent-primary" />
                  <span className="font-mono text-lg font-semibold text-accent-primary">
                    {formatUSDC(match.prizePool)}
                  </span>
                </div>
              </div>

              {/* Agent 2 */}
              <Link href={`/agents/${agent2.id}`} className="group">
                <motion.div
                  className="flex flex-col items-center text-center"
                  whileHover={{ scale: 1.02 }}
                >
                  <AgentAvatar name={agent2.name} strategy={agent2.strategy} size="xl" />
                  <h2 className="mt-4 text-xl font-bold group-hover:text-accent-primary transition-colors">
                    {agent2.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-mono text-text-muted">Rating: {agent2.rating}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {agent2.wins}W - {agent2.losses}L
                  </div>
                  {match.currentSplit && (
                    <div className="mt-3 px-4 py-2 bg-accent-purple/10 rounded-lg">
                      <span className="text-2xl font-bold text-accent-purple">
                        {match.currentSplit.agent2}%
                      </span>
                    </div>
                  )}
                </motion.div>
              </Link>
            </div>
          </div>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Feed - Takes 2 columns */}
          <div className="lg:col-span-2 h-[600px]">
            <LiveFeed
              messages={messages}
              agent1Id={agent1.id}
              agent2Id={agent2.id}
            />
          </div>

          {/* Sidebar - Markets */}
          <div className="space-y-6">
            <MatchMarkets markets={markets} matchId={match.id} />

            {/* Match Info Card */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Match Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Match ID</span>
                  <span className="font-mono">{match.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Arena</span>
                  <span>{arenaInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Prize Pool</span>
                  <span className="text-accent-primary font-mono">{formatUSDC(match.prizePool)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Max Rounds</span>
                  <span>{match.maxRounds}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bet Slip - Fixed at bottom when active */}
        {selections.length > 0 && <BetSlip />}
      </div>
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-32 bg-bg-tertiary rounded animate-pulse mb-6" />
        <div className="h-64 bg-bg-tertiary rounded-2xl animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[600px] bg-bg-tertiary rounded-2xl animate-pulse" />
          <div className="h-[400px] bg-bg-tertiary rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
