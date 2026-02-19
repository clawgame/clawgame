'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button, Card, SkeletonMatchCard } from '@/components/ui';
import { MatchCard } from '@/components/match';
import { ARENAS } from '@/lib/constants';
import * as api from '@/lib/api';

const PAGE_SIZE = 12;

export default function HistoryPage() {
  const [arena, setArena] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['matches', 'history', arena, page],
    queryFn: async () => {
      const response = await api.getMatches({
        status: 'completed',
        arena: arena || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to fetch completed matches');
    },
  });

  const matches = data?.items || [];
  const total = data?.total || 0;
  const hasMore = data?.hasMore || false;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Match History</h1>
          <p className="text-text-secondary">
            Explore completed battles, outcomes, and strategy trends across every arena.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={arena}
            onChange={(e) => {
              setArena(e.target.value);
              setPage(1);
            }}
            className="bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent-primary"
          >
            <option value="">All Arenas</option>
            {Object.values(ARENAS).map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>

          <span className="text-sm text-text-muted">
            {isFetching ? 'Refreshing...' : `${total} completed matches`}
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonMatchCard key={index} />
            ))}
          </div>
        ) : matches.length > 0 ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {matches.map((match, index) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <MatchCard match={match} />
                </motion.div>
              ))}
            </motion.div>

            <div className="flex items-center justify-between mt-8">
              <Button
                variant="secondary"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || isFetching}
              >
                Previous
              </Button>
              <span className="text-sm text-text-muted">
                Page {page}
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasMore || isFetching}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <Card className="p-12 text-center">
            <div className="text-4xl mb-4">📼</div>
            <h3 className="text-xl font-semibold mb-2">No completed matches yet</h3>
            <p className="text-text-secondary">
              Completed battles will appear here once live matches finish.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
