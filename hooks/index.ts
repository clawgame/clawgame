import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMatchStore } from '@/stores/matchStore';
import { useUserStore } from '@/stores/userStore';
import { useBetSlipStore } from '@/stores/betStore';
import { socketClient } from '@/lib/socket';
import * as api from '@/lib/api';
import type { WSEvent, PlaceBetInput } from '@/types';

// =============================================================================
// Match Hooks
// =============================================================================

export function useLiveMatches() {
  const setLiveMatches = useMatchStore(s => s.setLiveMatches);
  const setFeaturedMatch = useMatchStore(s => s.setFeaturedMatch);
  const updateLiveMatch = useMatchStore(s => s.updateLiveMatch);

  const query = useQuery({
    queryKey: ['matches', 'live'],
    queryFn: async () => {
      const response = await api.getLiveMatches();
      if (response.success && response.data) {
        setLiveMatches(response.data);
        // Set featured match as the one with highest prize pool
        const featured = response.data.reduce((max, match) => 
          match.prizePool > (max?.prizePool || 0) ? match : max
        , response.data[0] || null);
        setFeaturedMatch(featured);
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch matches');
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to global updates
  useEffect(() => {
    socketClient.connect();
    
    const unsubscribe = socketClient.subscribeGlobal((event: WSEvent) => {
      if (event.type === 'status' || event.type === 'spectators') {
        updateLiveMatch(event.matchId, event.data as Record<string, unknown>);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [updateLiveMatch]);

  return query;
}

export function useMatch(matchId: string) {
  const { setCurrentMatch, setMessages, setMarkets, addMessage } = useMatchStore();

  const query = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const response = await api.getMatch(matchId);
      if (response.success && response.data) {
        setCurrentMatch(response.data.match);
        setMessages(response.data.messages);
        setMarkets(response.data.markets);
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch match');
    },
    enabled: !!matchId,
  });

  // Subscribe to match updates
  useEffect(() => {
    if (!matchId) return;

    socketClient.connect();
    
    const unsubscribe = socketClient.subscribeToMatch(matchId, (event: WSEvent) => {
      switch (event.type) {
        case 'message':
          addMessage((event.data as { message: unknown }).message as Parameters<typeof addMessage>[0]);
          break;
        case 'round':
        case 'status':
          // Trigger refetch for major updates
          query.refetch();
          break;
        case 'odds':
          const oddsData = event.data as { marketId: string; option: string; odds: number; pool: number };
          useMatchStore.getState().updateMarketOdds(
            oddsData.marketId,
            oddsData.option,
            oddsData.odds,
            oddsData.pool
          );
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [matchId, addMessage, query]);

  return query;
}

// =============================================================================
// Leaderboard Hooks
// =============================================================================

export function useLeaderboard(params?: {
  arena?: string;
  period?: 'all' | 'month' | 'week' | 'day';
  limit?: number;
}) {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: async () => {
      const response = await api.getLeaderboard(params);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch leaderboard');
    },
  });
}

// =============================================================================
// Prediction Hooks
// =============================================================================

export function useMarkets(matchId?: string) {
  return useQuery({
    queryKey: ['markets', matchId],
    queryFn: async () => {
      const response = await api.getMarkets({ matchId, status: 'open' });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch markets');
    },
  });
}

export function useUserBets() {
  const { setActiveBets, setBetHistory } = useUserStore();

  return useQuery({
    queryKey: ['user', 'bets'],
    queryFn: async () => {
      const response = await api.getUserBets();
      if (response.success && response.data) {
        setActiveBets(response.data.active);
        setBetHistory(response.data.settled);
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch bets');
    },
  });
}

export function usePlaceBet() {
  const queryClient = useQueryClient();
  const { setProcessing, setError, clearSelections } = useBetSlipStore();
  const { setBalance } = useUserStore();

  return useMutation({
    mutationFn: async (input: PlaceBetInput) => {
      setProcessing(true);
      setError(null);
      
      const response = await api.placeBet(input);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to place bet');
    },
    onSuccess: (bet) => {
      // Update user balance
      const currentBalance = useUserStore.getState().balance;
      setBalance(currentBalance - bet.stake);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['user', 'bets'] });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      
      // Clear bet slip
      clearSelections();
    },
    onError: (error: Error) => {
      setError(error.message);
    },
    onSettled: () => {
      setProcessing(false);
    },
  });
}

// =============================================================================
// Agent Hooks
// =============================================================================

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const response = await api.getAgent(agentId);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch agent');
    },
    enabled: !!agentId,
  });
}

// =============================================================================
// Stats Hooks
// =============================================================================

export function useGlobalStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await api.getGlobalStats();
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch stats');
    },
    refetchInterval: 60000, // Refetch every minute
  });
}
