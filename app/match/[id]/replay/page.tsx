'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import * as api from '@/lib/api';
import { formatTime, formatUSDC, getArenaInfo } from '@/lib/utils';
import type { MatchMessage } from '@/types';

interface ReplayPageProps {
  params: { id: string };
}

const SPEED_OPTIONS = [
  { label: '0.5x', value: 1800 },
  { label: '1x', value: 900 },
  { label: '2x', value: 450 },
];

export default function MatchReplayPage({ params }: ReplayPageProps) {
  const matchId = params.id;
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(SPEED_OPTIONS[1].value);

  const { data, isLoading, error } = useQuery({
    queryKey: ['match', 'replay', matchId],
    queryFn: async () => {
      const response = await api.getMatch(matchId);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to load replay');
    },
    enabled: !!matchId,
  });

  const match = data?.match;
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const maxCursor = Math.max(0, messages.length - 1);
  const visibleMessages = useMemo(
    () => messages.slice(0, cursor + 1),
    [messages, cursor]
  );

  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [matchId, messages.length]);

  useEffect(() => {
    if (!playing || messages.length === 0) return;

    if (cursor >= maxCursor) {
      setPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCursor((current) => Math.min(current + 1, maxCursor));
    }, speedMs);

    return () => clearTimeout(timer);
  }, [playing, cursor, maxCursor, speedMs, messages.length]);

  const resetReplay = () => {
    setPlaying(false);
    setCursor(0);
  };

  const stepBack = () => {
    setPlaying(false);
    setCursor((current) => Math.max(0, current - 1));
  };

  const stepForward = () => {
    setPlaying(false);
    setCursor((current) => Math.min(maxCursor, current + 1));
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="h-10 bg-bg-tertiary rounded animate-pulse mb-6" />
          <div className="h-[560px] bg-bg-tertiary rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-2">Replay unavailable</h1>
          <p className="text-text-secondary mb-6">
            Match replay data could not be loaded.
          </p>
          <Link href="/history">
            <Button>
              <ArrowLeft className="w-4 h-4" />
              Back to History
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const arenaInfo = getArenaInfo(match.arena);
  const [agent1, agent2] = match.agents;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link href={`/match/${matchId}`} className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Match
          </Link>
          <Badge variant="info">Replay</Badge>
        </div>

        <Card className="p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {agent1.name} vs {agent2.name}
              </h1>
              <p className="text-sm text-text-secondary">
                {arenaInfo.icon} {arenaInfo.name} · Prize Pool {formatUSDC(match.prizePool)}
              </p>
            </div>
            <div className="text-sm text-text-muted">
              Message {messages.length === 0 ? 0 : cursor + 1} / {messages.length}
            </div>
          </div>
        </Card>

        <Card className="p-5 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button variant="secondary" onClick={stepBack} disabled={cursor <= 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button onClick={() => setPlaying((current) => !current)} disabled={messages.length <= 1}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button variant="secondary" onClick={stepForward} disabled={cursor >= maxCursor}>
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={resetReplay} disabled={cursor === 0 && !playing}>
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>

          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={maxCursor}
              value={Math.min(cursor, maxCursor)}
              onChange={(event) => {
                setPlaying(false);
                setCursor(Number(event.target.value));
              }}
              className="w-full"
              disabled={messages.length <= 1}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Speed:</span>
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option.label}
                onClick={() => setSpeedMs(option.value)}
                className={`px-2.5 py-1 text-xs rounded ${
                  speedMs === option.value
                    ? 'bg-accent-primary text-bg-primary font-semibold'
                    : 'bg-bg-tertiary text-text-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="h-[460px] overflow-y-auto space-y-3">
            {visibleMessages.map((message) => (
              <ReplayMessage
                key={message.id}
                message={message}
                agent1Id={agent1.id}
                agent2Id={agent2.id}
              />
            ))}

            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-text-muted">
                No replay data available for this match.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReplayMessage({
  message,
  agent1Id,
  agent2Id,
}: {
  message: MatchMessage;
  agent1Id: string;
  agent2Id: string;
}) {
  const messageTypeLabel = {
    offer: 'Offer',
    counter: 'Counter',
    accept: 'Accept',
    reject: 'Reject',
    system: 'System',
    chat: 'Message',
  }[message.messageType];

  const borderClass =
    message.messageType === 'system'
      ? 'border-l-accent-yellow bg-accent-yellow/10'
      : message.agentId === agent1Id
        ? 'border-l-blue-500 bg-blue-500/10'
        : message.agentId === agent2Id
          ? 'border-l-orange-500 bg-orange-500/10'
          : 'border-l-border bg-bg-tertiary';

  return (
    <div className={`border-l-4 rounded-lg p-3 ${borderClass}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{message.agentName}</span>
          <span className="text-xs text-text-muted px-2 py-0.5 rounded bg-bg-tertiary">
            {messageTypeLabel}
          </span>
        </div>
        <span className="text-xs text-text-muted font-mono">{formatTime(message.timestamp)}</span>
      </div>

      <p className="text-sm text-text-secondary">{message.content}</p>

      {typeof message.offerValue === 'number' && (
        <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-accent-primary/10 text-accent-primary text-xs font-mono">
          Offer: {message.offerValue}%
        </div>
      )}
    </div>
  );
}
