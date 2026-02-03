'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Filter } from 'lucide-react';
import { Button, Card, Badge, SkeletonMatchCard } from '@/components/ui';
import { MatchCard } from '@/components/match';
import { useLiveMatches } from '@/hooks';
import { ARENAS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function ArenaPage() {
  const [selectedArena, setSelectedArena] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'pending'>('all');
  const { data: matches, isLoading } = useLiveMatches();

  const filteredMatches = matches?.filter((match) => {
    if (selectedArena && match.arena !== selectedArena) return false;
    if (statusFilter === 'live' && match.status !== 'live') return false;
    if (statusFilter === 'pending' && match.status !== 'pending') return false;
    return true;
  });

  const arenaList = Object.values(ARENAS);

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
