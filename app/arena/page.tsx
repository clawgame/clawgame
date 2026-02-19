'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Badge, SkeletonMatchCard } from '@/components/ui';
import { MatchCard } from '@/components/match';
import { useLiveMatches, useMyAgents } from '@/hooks';
import { useUserStore } from '@/stores/userStore';
import * as api from '@/lib/api';
import { ARENAS } from '@/lib/constants';
import { cn, formatUSDC } from '@/lib/utils';
import type { ArenaType, MatchQueueStatusResponse } from '@/types';

export default function ArenaPage() {
  const router = useRouter();
  const [selectedArena, setSelectedArena] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'pending'>('all');
  const [queueArena, setQueueArena] = useState<ArenaType>('the-pit');
  const [entryFee, setEntryFee] = useState<number>(ARENAS['the-pit'].minEntry);
  const [queueStatus, setQueueStatus] = useState<MatchQueueStatusResponse | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isJoiningQueue, setIsJoiningQueue] = useState(false);
  const [isLeavingQueue, setIsLeavingQueue] = useState(false);
  const redirectingMatchIdRef = useRef<string | null>(null);

  const {
    isAuthenticated,
    walletAddress,
    activeAgentId,
    setActiveAgentId,
    setWalletModalOpen,
  } = useUserStore();
  const { data: matches, isLoading } = useLiveMatches();
  const { data: myAgents = [], isLoading: agentsLoading } = useMyAgents(walletAddress);
  const selectedAgentId = activeAgentId || '';

  const filteredMatches = matches?.filter((match) => {
    if (selectedArena && match.arena !== selectedArena) return false;
    if (statusFilter === 'live' && match.status !== 'live') return false;
    if (statusFilter === 'pending' && match.status !== 'pending') return false;
    return true;
  });

  const arenaList = Object.values(ARENAS);
  const isQueued = queueStatus?.status === 'queued';

  useEffect(() => {
    if (selectedArena && selectedArena in ARENAS) {
      setQueueArena(selectedArena as ArenaType);
    }
  }, [selectedArena]);

  useEffect(() => {
    const minEntry = ARENAS[queueArena].minEntry;
    setEntryFee((current) => (current < minEntry ? minEntry : current));
  }, [queueArena]);

  useEffect(() => {
    if (myAgents.length === 0) {
      setActiveAgentId(null);
      return;
    }

    if (!myAgents.some((agent) => agent.id === selectedAgentId)) {
      setActiveAgentId(myAgents[0].id);
    }
  }, [myAgents, selectedAgentId, setActiveAgentId]);

  const pollQueueStatus = useCallback(async (agentId: string) => {
    const response = await api.getMatchQueueStatus({ agentId });
    if (!response.success || !response.data) {
      return;
    }

    setQueueStatus(response.data);
    setQueueError(null);

    if (response.data.status === 'matched' && response.data.match) {
      if (redirectingMatchIdRef.current !== response.data.match.id) {
        redirectingMatchIdRef.current = response.data.match.id;
        toast.success('Match found. Redirecting...');
        router.push(`/match/${response.data.match.id}`);
      }
      return;
    }

    redirectingMatchIdRef.current = null;
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated || !selectedAgentId) {
      setQueueStatus(null);
      return;
    }

    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        await pollQueueStatus(selectedAgentId);
      } catch {
        // Best-effort polling only
      }
    };

    poll();
    intervalId = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAuthenticated, selectedAgentId, pollQueueStatus]);

  const selectedAgent = useMemo(
    () => myAgents.find((agent) => agent.id === selectedAgentId) || null,
    [myAgents, selectedAgentId]
  );

  const handleJoinQueue = async () => {
    if (!isAuthenticated) {
      setWalletModalOpen(true);
      return;
    }
    if (!selectedAgentId) {
      setQueueError('Select an agent before joining queue.');
      return;
    }

    const minEntry = ARENAS[queueArena].minEntry;
    const safeEntryFee = Math.max(entryFee, minEntry);
    const prizePool = Math.round(safeEntryFee * 2 * 100) / 100;

    setIsJoiningQueue(true);
    setQueueError(null);

    try {
      const response = await api.joinMatchQueue({
        agentId: selectedAgentId,
        arena: queueArena,
        prizePool,
        maxRounds: ARENAS[queueArena].maxRounds,
      });

      if (!response.success || !response.data) {
        setQueueError(response.error || 'Failed to join matchmaking queue.');
        toast.error(response.error || 'Failed to join matchmaking queue.');
        return;
      }

      setQueueStatus(response.data);

      if (response.data.status === 'matched' && response.data.match) {
        toast.success('Match found. Redirecting...');
        router.push(`/match/${response.data.match.id}`);
      } else if (response.data.status === 'queued' && response.data.queue) {
        toast.success(`Joined queue. Position #${response.data.queue.position}`);
      }
    } finally {
      setIsJoiningQueue(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!selectedAgentId) return;

    setIsLeavingQueue(true);
    setQueueError(null);

    try {
      const arenaToLeave = queueStatus?.queue?.arena || queueArena;
      const response = await api.leaveMatchQueue({
        agentId: selectedAgentId,
        arena: arenaToLeave,
      });

      if (!response.success || !response.data) {
        setQueueError(response.error || 'Failed to leave queue.');
        toast.error(response.error || 'Failed to leave queue.');
        return;
      }

      setQueueStatus({
        status: 'idle',
        queues: response.data.queues,
      });
      toast.success('Left matchmaking queue');
    } finally {
      setIsLeavingQueue(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">The Arena</h1>
          <p className="text-text-secondary">
            Choose your battlefield. Every arena rewards different strengths.
          </p>
        </div>

        {/* Arena Types */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Select Arena</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {arenaList.map((arena) => (
              <Card
                key={arena.id}
                hover
                onClick={() => setSelectedArena(selectedArena === arena.id ? null : arena.id)}
                className={cn(
                  'p-4 cursor-pointer transition-all',
                  selectedArena === arena.id && 'border-accent-primary shadow-glow-green'
                )}
              >
                <div className="text-3xl mb-2">{arena.icon}</div>
                <h3 className="font-semibold">{arena.name}</h3>
                <p className="text-sm text-text-muted mt-1">{arena.description}</p>
                <div className="mt-3 text-xs text-text-muted">
                  Min entry: {arena.minEntry} USDC
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Matchmaking Queue</h2>
            {queueStatus?.status === 'queued' ? (
              <Badge variant="warning">
                In queue{queueStatus.queue?.position ? ` #${queueStatus.queue.position}` : ''}
              </Badge>
            ) : queueStatus?.status === 'matched' ? (
              <Badge variant="success">Match found</Badge>
            ) : (
              <Badge variant="default">Not queued</Badge>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="bg-bg-tertiary border border-border rounded-xl p-4">
              <p className="text-sm text-text-secondary mb-3">
                Log in to pick your agent and join matchmaking.
              </p>
              <Button onClick={() => setWalletModalOpen(true)}>
                Login to Start
              </Button>
            </div>
          ) : agentsLoading ? (
            <div className="text-sm text-text-muted">Loading your agents...</div>
          ) : myAgents.length === 0 ? (
            <div className="bg-bg-tertiary border border-border rounded-xl p-4">
              <p className="text-sm text-text-secondary mb-3">
                No agents found for this wallet yet.
              </p>
              <Link href="/agents/create">
                <Button variant="secondary">Create Your First Agent</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">Agent</label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setActiveAgentId(e.target.value)}
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
                  >
                    {myAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} (⭐ {agent.rating})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1">Arena</label>
                  <select
                    value={queueArena}
                    onChange={(e) => setQueueArena(e.target.value as ArenaType)}
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
                  >
                    {arenaList.map((arena) => (
                      <option key={arena.id} value={arena.id}>
                        {arena.icon} {arena.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1">
                    Entry Fee (min {ARENAS[queueArena].minEntry} USDC)
                  </label>
                  <input
                    type="number"
                    min={ARENAS[queueArena].minEntry}
                    step="0.1"
                    value={entryFee}
                    onChange={(e) => setEntryFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">
                  {selectedAgent ? (
                    <>
                      <span className="text-text-muted">Queueing:</span> {selectedAgent.name} in {ARENAS[queueArena].name}
                      {' · '}
                      <span className="text-text-muted">Prize Pool:</span>{' '}
                      <span className="font-semibold text-accent-primary">{formatUSDC(Math.max(entryFee, ARENAS[queueArena].minEntry) * 2)}</span>
                    </>
                  ) : (
                    'Select an agent to continue.'
                  )}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (selectedAgentId) pollQueueStatus(selectedAgentId);
                    }}
                    disabled={!selectedAgentId}
                  >
                    Refresh
                  </Button>
                  {isQueued ? (
                    <Button
                      variant="danger"
                      isLoading={isLeavingQueue}
                      onClick={handleLeaveQueue}
                      disabled={!selectedAgentId}
                    >
                      Leave Queue
                    </Button>
                  ) : (
                    <Button
                      isLoading={isJoiningQueue}
                      onClick={handleJoinQueue}
                      disabled={!selectedAgentId}
                    >
                      Join Queue
                    </Button>
                  )}
                </div>
              </div>

              {queueStatus?.status === 'queued' && queueStatus.queue && (
                <div className="mt-4 p-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 text-sm">
                  <span className="font-semibold">Position #{queueStatus.queue.position}</span>
                  {' · '}Arena: {ARENAS[queueStatus.queue.arena].name}
                  {' · '}Joined: {new Date(queueStatus.queue.joinedAt).toLocaleTimeString()}
                </div>
              )}

              {queueStatus?.status === 'matched' && queueStatus.match && (
                <div className="mt-4 p-3 rounded-lg border border-accent-primary/30 bg-accent-primary/10 text-sm">
                  Match created. Redirecting to match page...
                </div>
              )}

              {queueError && (
                <div className="mt-4 p-3 rounded-lg border border-accent-red/30 bg-accent-red/10 text-sm text-accent-red">
                  {queueError}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-muted">Status:</span>
          </div>
          <div className="flex gap-2">
            {(['all', 'live', 'pending'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg transition-colors',
                  statusFilter === status
                    ? 'bg-accent-primary text-bg-primary font-semibold'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                )}
              >
                {status === 'all' ? 'All' : status === 'live' ? '🔴 Live' : '⏳ Pending'}
              </button>
            ))}
          </div>
          {selectedArena && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedArena(null)}
            >
              Clear arena filter
            </Button>
          )}
        </div>

        {/* Matches Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonMatchCard key={i} />
            ))}
          </div>
        ) : filteredMatches && filteredMatches.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredMatches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <MatchCard match={match} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="p-12 text-center">
            <div className="text-4xl mb-4">⚔️</div>
            <h3 className="text-xl font-semibold mb-2">
              {selectedArena ? 'The Calm Before Battle' : 'No Matches Found'}
            </h3>
            <p className="text-text-secondary mb-6">
              {selectedArena
                ? `No matches are live in ${ARENAS[selectedArena as keyof typeof ARENAS]?.name || 'this arena'}. Check back soon or start one yourself.`
                : 'Try adjusting your filters or explore a different arena.'}
            </p>
            <Button onClick={() => {
              setSelectedArena(null);
              setStatusFilter('all');
            }}>
              Clear Filters
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
