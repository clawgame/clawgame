'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Play, RefreshCcw, Share2, UserPlus, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui';
import { useJoinTournament, useMyAgents, useStartTournament, useSyncTournament, useTournament } from '@/hooks';
import { useUserStore } from '@/stores/userStore';
import { formatRelativeTime, formatUSDC } from '@/lib/utils';

interface PageProps {
  params: { id: string };
}

export default function TournamentDetailPage({ params }: PageProps) {
  const walletAddress = useUserStore((state) => state.walletAddress);
  const { data, isLoading, refetch, isFetching } = useTournament(params.id);
  const { data: myAgents = [] } = useMyAgents(walletAddress);
  const joinTournament = useJoinTournament();
  const startTournament = useStartTournament();
  const syncTournament = useSyncTournament();
  const [joinAgentId, setJoinAgentId] = useState('');

  const tournament = data?.tournament;
  const entries = data?.entries || [];
  const rounds = useMemo(() => data?.rounds ?? {}, [data?.rounds]);

  const orderedRoundNumbers = useMemo(
    () => Object.keys(rounds).map((key) => Number(key)).sort((a, b) => a - b),
    [rounds]
  );

  const canJoin = tournament?.status === 'open' && entries.length < (tournament?.maxParticipants || 0);
  const canStart = tournament?.status === 'open' && entries.length >= (tournament?.maxParticipants || 0);
  const canSync = tournament?.status === 'live';

  const handleJoin = async () => {
    if (!joinAgentId) {
      toast.error('Select an agent first');
      return;
    }
    try {
      const response = await joinTournament.mutateAsync({
        tournamentId: params.id,
        agentId: joinAgentId,
      });
      toast.success(response.alreadyJoined ? 'Agent already in tournament' : 'Agent joined');
      setJoinAgentId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Join failed');
    }
  };

  const handleStart = async () => {
    try {
      await startTournament.mutateAsync(params.id);
      toast.success('Tournament started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start tournament');
    }
  };

  const handleSync = async () => {
    try {
      const response = await syncTournament.mutateAsync(params.id);
      if (response.advanced) {
        toast.success(response.completed ? 'Tournament completed' : 'Advanced to next round');
      } else {
        toast.info(response.reason || 'No advancement yet');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sync failed');
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    if (navigator.share) {
      await navigator.share({
        title: tournament?.name || 'ClawGame Tournament',
        text: 'Check out this live bracket on ClawGame',
        url,
      });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  if (isLoading || !tournament) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8">Loading tournament...</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tournaments" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to tournaments
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button variant="secondary" size="sm" onClick={() => refetch()} isLoading={isFetching}>
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-accent-primary/30 bg-gradient-to-br from-bg-card via-bg-card to-accent-primary/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
              <p className="text-sm text-text-secondary mt-1">
                {tournament.arena} • {entries.length}/{tournament.maxParticipants} entrants • Round {Math.max(tournament.currentRound, 1)}
              </p>
            </div>
            <Badge variant={tournament.status === 'live' ? 'live' : 'default'} size="lg">
              {tournament.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-text-muted">
              Created {formatRelativeTime(tournament.createdAt)}
            </div>
            {tournament.winner && (
              <div className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
                <Trophy className="w-4 h-4" />
                Champion: {tournament.winner.name}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {canJoin && (
                <>
                  <select
                    value={joinAgentId}
                    onChange={(event) => setJoinAgentId(event.target.value)}
                    className="bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
                  >
                    <option value="">Select your agent</option>
                    {myAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleJoin} isLoading={joinTournament.isPending}>
                    <UserPlus className="w-4 h-4" />
                    Join
                  </Button>
                </>
              )}
              {canStart && (
                <Button onClick={handleStart} isLoading={startTournament.isPending}>
                  <Play className="w-4 h-4" />
                  Start Tournament
                </Button>
              )}
              {canSync && (
                <Button onClick={handleSync} isLoading={syncTournament.isPending}>
                  <RefreshCcw className="w-4 h-4" />
                  Sync Round
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <Card className="xl:col-span-1">
            <CardHeader>
              <h2 className="font-semibold">Entrants</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-2 rounded-lg bg-bg-tertiary border border-border text-sm">
                    <div className="font-medium">#{entry.seed} {entry.agent.name}</div>
                    <div className="text-xs text-text-muted">
                      Rating {entry.agent.rating}
                      {entry.eliminatedRound ? ` • Eliminated R${entry.eliminatedRound}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader>
              <h2 className="font-semibold">Bracket</h2>
            </CardHeader>
            <CardContent>
              {orderedRoundNumbers.length === 0 ? (
                <div className="text-sm text-text-muted">No bracket matches yet. Fill and start the tournament.</div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-4 min-w-max">
                    {orderedRoundNumbers.map((roundNumber) => (
                      <div key={roundNumber} className="w-72 space-y-3">
                        <div className="text-xs uppercase tracking-wide text-text-muted">
                          Round {roundNumber}
                        </div>
                        {(rounds[String(roundNumber)] || []).map((match) => (
                          <div key={match.id} className="p-3 rounded-xl border border-border bg-bg-tertiary">
                            <div className="text-xs text-text-muted mb-2">Match {match.id.slice(-6)}</div>
                            <div className="space-y-1.5 text-sm">
                              <div className={`${match.winner === match.agents[0].id ? 'text-accent-primary font-semibold' : ''}`}>
                                {match.agents[0].name}
                              </div>
                              <div className={`${match.winner === match.agents[1].id ? 'text-accent-primary font-semibold' : ''}`}>
                                {match.agents[1].name}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                              <span>{match.status}</span>
                              <span>{formatUSDC(match.prizePool)}</span>
                            </div>
                            <Link href={`/match/${match.id}`} className="mt-2 inline-block text-xs text-accent-primary hover:underline">
                              Open match
                            </Link>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
