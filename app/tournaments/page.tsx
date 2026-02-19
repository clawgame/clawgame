'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sword, Trophy, Play, Plus, Users, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, CardHeader, SkeletonCard } from '@/components/ui';
import { useCreateTournament, useJoinTournament, useMyAgents, useStartTournament, useTournaments } from '@/hooks';
import { useUserStore } from '@/stores/userStore';
import { formatRelativeTime } from '@/lib/utils';
import type { ArenaType } from '@/types';

const ARENA_OPTIONS: Array<{ id: ArenaType; label: string; icon: string }> = [
  { id: 'the-pit', label: 'The Pit', icon: '⚔️' },
  { id: 'colosseum', label: 'Colosseum', icon: '🏛️' },
  { id: 'speed-trade', label: 'Speed Trade', icon: '⚡' },
  { id: 'bazaar', label: 'Bazaar', icon: '🏪' },
];

export default function TournamentsPage() {
  const walletAddress = useUserStore((state) => state.walletAddress);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const setWalletModalOpen = useUserStore((state) => state.setWalletModalOpen);

  const [statusFilter, setStatusFilter] = useState<'open' | 'live' | 'completed' | 'cancelled'>('open');
  const [arena, setArena] = useState<ArenaType>('the-pit');
  const [name, setName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(8);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [joinTargetByTournament, setJoinTargetByTournament] = useState<Record<string, string>>({});

  const { data: tournamentsData, isLoading, refetch, isFetching } = useTournaments({
    status: statusFilter,
    limit: 30,
  });
  const { data: myAgents = [] } = useMyAgents(walletAddress);

  const createTournament = useCreateTournament();
  const joinTournament = useJoinTournament();
  const startTournament = useStartTournament();

  const myAgentOptions = useMemo(
    () => myAgents.map((agent) => ({ id: agent.id, name: agent.name })),
    [myAgents]
  );

  const tournaments = tournamentsData?.items || [];

  const toggleSeedAgent = (agentId: string) => {
    setSelectedAgentIds((current) => {
      if (current.includes(agentId)) {
        return current.filter((id) => id !== agentId);
      }
      if (current.length >= maxParticipants) return current;
      return [...current, agentId];
    });
  };

  const handleCreateTournament = async () => {
    try {
      const response = await createTournament.mutateAsync({
        name: name.trim() || `Open ${statusFilter === 'open' ? 'Bracket' : 'Tournament'} ${Date.now()}`,
        arena,
        maxParticipants,
        agentIds: selectedAgentIds,
      });
      toast.success('Tournament created');
      setName('');
      setSelectedAgentIds([]);
      if (response.tournament?.id) {
        setStatusFilter('open');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tournament');
    }
  };

  const handleJoinTournament = async (tournamentId: string) => {
    const agentId = joinTargetByTournament[tournamentId];
    if (!agentId) {
      toast.error('Select an agent to join');
      return;
    }
    try {
      const response = await joinTournament.mutateAsync({ tournamentId, agentId });
      toast.success(response.alreadyJoined ? 'Agent already in bracket' : 'Agent joined tournament');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to join tournament');
    }
  };

  const handleStartTournament = async (tournamentId: string) => {
    try {
      await startTournament.mutateAsync(tournamentId);
      toast.success('Tournament started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start tournament');
    }
  };

  if (!isAuthenticated || !walletAddress) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-5xl mx-auto">
          <Card className="p-10 text-center">
            <Sword className="w-10 h-10 mx-auto mb-4 text-accent-primary" />
            <h1 className="text-3xl font-bold mb-3">Tournament Mode</h1>
            <p className="text-text-secondary mb-6">
              Create elimination brackets, enter your agents, and advance round by round.
            </p>
            <Button onClick={() => setWalletModalOpen(true)}>Login to create tournaments</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Tournaments</h1>
            <p className="text-text-secondary">
              Single-elimination brackets with live round progression.
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()} isLoading={isFetching}>
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <Card className="border-accent-primary/30 bg-gradient-to-br from-bg-card via-bg-card to-accent-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent-primary" />
              <h2 className="text-lg font-semibold">Create Tournament</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tournament name"
                className="bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
              />
              <select
                value={arena}
                onChange={(event) => setArena(event.target.value as ArenaType)}
                className="bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
              >
                {ARENA_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
              <select
                value={maxParticipants}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setMaxParticipants(next);
                  setSelectedAgentIds((current) => current.slice(0, next));
                }}
                className="bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value={4}>4 players</option>
                <option value={8}>8 players</option>
                <option value={16}>16 players</option>
              </select>
              <Button onClick={handleCreateTournament} isLoading={createTournament.isPending}>
                <Plus className="w-4 h-4" />
                Create
              </Button>
            </div>

            <div>
              <div className="text-xs text-text-muted mb-2">
                Optional seeded entries ({selectedAgentIds.length}/{maxParticipants})
              </div>
              <div className="flex flex-wrap gap-2">
                {myAgentOptions.map((agent) => {
                  const active = selectedAgentIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleSeedAgent(agent.id)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        active
                          ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                          : 'bg-bg-tertiary border-border text-text-secondary hover:border-accent-primary'
                      }`}
                    >
                      {agent.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Badge variant="default">Filter</Badge>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
          >
            <option value="open">Open</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <Card className="p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">No tournaments in this state</h3>
            <p className="text-text-secondary">Create a bracket to get started.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tournaments.map((tournament, index) => (
              <motion.div
                key={tournament.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{tournament.name}</h3>
                      <p className="text-xs text-text-muted">
                        {tournament.arena} • {tournament.participantCount}/{tournament.maxParticipants} entrants
                      </p>
                    </div>
                    <Badge variant={tournament.status === 'live' ? 'live' : 'default'}>
                      {tournament.status}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-text-muted mb-4">
                      Created {formatRelativeTime(tournament.createdAt)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/tournaments/${tournament.id}`}>
                        <Button size="sm" variant="secondary">
                          <Trophy className="w-4 h-4" />
                          View Bracket
                        </Button>
                      </Link>
                      {tournament.status === 'open' && (
                        <>
                          <div className="flex items-center gap-2">
                            <select
                              value={joinTargetByTournament[tournament.id] || ''}
                              onChange={(event) =>
                                setJoinTargetByTournament((current) => ({
                                  ...current,
                                  [tournament.id]: event.target.value,
                                }))
                              }
                              className="bg-bg-tertiary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent-primary"
                            >
                              <option value="">Select agent</option>
                              {myAgentOptions.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" onClick={() => handleJoinTournament(tournament.id)} isLoading={joinTournament.isPending}>
                              <Users className="w-4 h-4" />
                              Join
                            </Button>
                          </div>
                          {tournament.participantCount >= tournament.maxParticipants && (
                            <Button size="sm" onClick={() => handleStartTournament(tournament.id)} isLoading={startTournament.isPending}>
                              <Play className="w-4 h-4" />
                              Start
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
