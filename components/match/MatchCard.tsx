'use client';

import Link from 'next/link';
import { Users, Trophy } from 'lucide-react';
import { cn, formatUSDC, getArenaInfo, getStatusInfo } from '@/lib/utils';
import { Card, Badge } from '@/components/ui';
import { AgentAvatar } from './AgentAvatar';
import type { Match } from '@/types';

interface MatchCardProps {
  match: Match;
  variant?: 'default' | 'compact';
}

export function MatchCard({ match, variant = 'default' }: MatchCardProps) {
  const arenaInfo = getArenaInfo(match.arena);
  const statusInfo = getStatusInfo(match.status);
  const [agent1, agent2] = match.agents;

  if (variant === 'compact') {
    return (
      <Link href={`/match/${match.id}`}>
        <Card hover className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span>{arenaInfo.icon}</span>
              <span>{arenaInfo.name}</span>
            </div>
            <Badge variant={match.status === 'live' ? 'live' : 'default'} size="sm">
              {statusInfo.label}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AgentAvatar name={agent1.name} strategy={agent1.strategy} size="sm" />
              <span className="text-sm font-medium truncate max-w-[80px]">{agent1.name}</span>
            </div>
            <span className="text-text-muted text-sm font-bold">vs</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate max-w-[80px]">{agent2.name}</span>
              <AgentAvatar name={agent2.name} strategy={agent2.strategy} size="sm" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-text-muted">Prize</span>
            <span className="font-mono text-accent-primary">{formatUSDC(match.prizePool)}</span>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/match/${match.id}`}>
      <Card hover className="overflow-hidden">
        {/* Header */}
        <div className="bg-bg-tertiary px-4 py-3 flex items-center justify-between">
          <div className={cn('flex items-center gap-2 text-sm', arenaInfo.color)}>
            <span>{arenaInfo.icon}</span>
            <span className="font-medium">{arenaInfo.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {match.status === 'live' && (
              <span className="font-mono text-xs text-text-muted">
                Round {match.round}/{match.maxRounds}
              </span>
            )}
            <Badge variant={match.status === 'live' ? 'live' : 'default'} size="sm">
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Body - Agents */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            {/* Agent 1 */}
            <div className="flex flex-col items-center text-center">
              <AgentAvatar name={agent1.name} strategy={agent1.strategy} size="lg" />
              <h3 className="mt-3 font-semibold text-text-primary truncate max-w-[100px]">
                {agent1.name}
              </h3>
              <span className="text-sm font-mono text-text-muted">⭐ {agent1.rating}</span>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-text-muted">VS</span>
              {match.currentSplit && (
                <div className="mt-2 text-xs font-mono text-text-muted">
                  {match.currentSplit.agent1}% - {match.currentSplit.agent2}%
                </div>
              )}
            </div>

            {/* Agent 2 */}
            <div className="flex flex-col items-center text-center">
              <AgentAvatar name={agent2.name} strategy={agent2.strategy} size="lg" />
              <h3 className="mt-3 font-semibold text-text-primary truncate max-w-[100px]">
                {agent2.name}
              </h3>
              <span className="text-sm font-mono text-text-muted">⭐ {agent2.rating}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent-primary" />
            <span className="font-mono text-sm text-accent-primary font-semibold">
              {formatUSDC(match.prizePool)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted text-sm">
            <Users className="w-4 h-4" />
            <span>{match.spectatorCount}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
