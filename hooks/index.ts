import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMatchStore } from '@/stores/matchStore';
import { useUserStore } from '@/stores/userStore';
import { useBetSlipStore } from '@/stores/betStore';
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
  return query;
}

export function useMatch(matchId: string) {
  const setCurrentMatch = useMatchStore((state) => state.setCurrentMatch);
  const setMessages = useMatchStore((state) => state.setMessages);
  const setMarkets = useMatchStore((state) => state.setMarkets);
  const addMessage = useMatchStore((state) => state.addMessage);
  const currentMatch = useMatchStore((state) => state.currentMatch);
  const messages = useMatchStore((state) => state.messages);
  const markets = useMatchStore((state) => state.markets);

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
  const refetchMatch = query.refetch;

  // Subscribe to match updates via SSE
  useEffect(() => {
    if (!matchId) return;

    const eventSource = new EventSource(`/api/matches/${matchId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const wsEvent = JSON.parse(event.data) as WSEvent;

        switch (wsEvent.type) {
          case 'message': {
            const msgData = wsEvent.data as { message: Parameters<typeof addMessage>[0] };
            addMessage(msgData.message);
            break;
          }
          case 'round':
          case 'status':
          case 'match_start':
          case 'match_end':
            refetchMatch();
            break;
          case 'odds': {
            const oddsData = wsEvent.data as { marketId: string; option: string; odds: number; pool: number };
            useMatchStore.getState().updateMarketOdds(
              oddsData.marketId,
              oddsData.option,
              oddsData.odds,
              oddsData.pool
            );
            break;
          }
          case 'spectators': {
            const spectatorsData = wsEvent.data as { count: number };
            useMatchStore.getState().updateLiveMatch(matchId, {
              spectatorCount: spectatorsData.count,
            });
            break;
          }
        }
      } catch {
        // Ignore parse errors (keepalive comments, etc.)
      }
    };

    eventSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [matchId, addMessage, refetchMatch]);

  const liveData = currentMatch
    ? {
        match: currentMatch,
        messages,
        markets,
      }
    : query.data;

  return {
    ...query,
    data: liveData,
  };
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
  const walletAddress = useUserStore((state) => state.walletAddress);

  return useQuery({
    queryKey: ['user', 'bets', walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        setActiveBets([]);
        setBetHistory([]);
        return { active: [], settled: [], totalWinnings: 0 };
      }

      const response = await api.getUserBets({ walletAddress });
      if (response.success && response.data) {
        setActiveBets(response.data.active);
        setBetHistory(response.data.settled);
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch bets');
    },
    enabled: !!walletAddress,
  });
}

export function useNotifications(params?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const walletAddress = useUserStore((state) => state.walletAddress);

  return useQuery({
    queryKey: ['user', 'notifications', walletAddress, params],
    queryFn: async () => {
      if (!walletAddress) {
        return {
          items: [],
          total: 0,
          unreadCount: 0,
          page: 1,
          pageSize: params?.limit || 25,
          hasMore: false,
        };
      }

      const response = await api.getNotifications({
        walletAddress,
        unreadOnly: params?.unreadOnly,
        limit: params?.limit,
        offset: params?.offset,
      });

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to fetch notifications');
    },
    enabled: !!walletAddress,
    refetchInterval: 15000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const walletAddress = useUserStore((state) => state.walletAddress);

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!walletAddress) throw new Error('Wallet not connected');

      const response = await api.markNotificationRead({
        walletAddress,
        notificationId,
      });

      if (response.success && response.data) {
        return response.data.notification;
      }

      throw new Error(response.error || 'Failed to mark notification as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'notifications', walletAddress] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const walletAddress = useUserStore((state) => state.walletAddress);

  return useMutation({
    mutationFn: async () => {
      if (!walletAddress) throw new Error('Wallet not connected');

      const response = await api.markNotificationsRead({ walletAddress });
      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to mark notifications as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'notifications', walletAddress] });
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
  const walletAddress = useUserStore((state) => state.walletAddress);

  return useQuery({
    queryKey: ['agent', agentId, walletAddress],
    queryFn: async () => {
      const response = await api.getAgent(agentId, walletAddress);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch agent');
    },
    enabled: !!agentId,
  });
}

export function useMyAgents(walletAddress?: string | null) {
  const { setAgents } = useUserStore();

  return useQuery({
    queryKey: ['agents', 'mine', walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        setAgents([]);
        return [];
      }
      const response = await api.getAgents({ walletAddress, limit: 50 });
      if (response.success && response.data) {
        setAgents(response.data.items);
        return response.data.items;
      }
      throw new Error(response.error || 'Failed to fetch agents');
    },
    enabled: !!walletAddress,
  });
}

// =============================================================================
// Tournament Hooks
// =============================================================================

export function useTournaments(params?: {
  status?: 'open' | 'live' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['tournaments', params],
    queryFn: async () => {
      const response = await api.getTournaments(params);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch tournaments');
    },
    refetchInterval: 10000,
  });
}

export function useTournament(tournamentId: string) {
  return useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const response = await api.getTournament(tournamentId);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch tournament');
    },
    enabled: !!tournamentId,
    refetchInterval: 10000,
  });
}

export function useCreateTournament() {
  const walletAddress = useUserStore((state) => state.walletAddress);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      arena: 'the-pit' | 'colosseum' | 'speed-trade' | 'bazaar';
      maxParticipants: number;
      agentIds?: string[];
    }) => {
      const response = await api.createTournament({
        ...input,
        walletAddress: walletAddress || undefined,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to create tournament');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export function useJoinTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tournamentId: string; agentId: string }) => {
      const response = await api.joinTournament(input);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to join tournament');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournament', variables.tournamentId] });
    },
  });
}

export function useStartTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const response = await api.startTournament(tournamentId);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to start tournament');
    },
    onSuccess: (_, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['matches', 'live'] });
    },
  });
}

export function useSyncTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const response = await api.syncTournament(tournamentId);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to sync tournament');
    },
    onSuccess: (_, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['matches', 'live'] });
    },
  });
}

// =============================================================================
// Social Hooks
// =============================================================================

export function useFollowedAgents() {
  const walletAddress = useUserStore((state) => state.walletAddress);

  return useQuery({
    queryKey: ['social', 'follows', walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        return { items: [], total: 0 };
      }
      const response = await api.getFollowedAgents(walletAddress);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch followed agents');
    },
    enabled: !!walletAddress,
  });
}

export function useToggleFollowAgent() {
  const walletAddress = useUserStore((state) => state.walletAddress);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { agentId: string; follow: boolean }) => {
      if (!walletAddress) throw new Error('Wallet not connected');
      if (input.follow) {
        const response = await api.followAgent({ walletAddress, agentId: input.agentId });
        if (response.success && response.data) return response.data;
        throw new Error(response.error || 'Failed to follow agent');
      }
      const response = await api.unfollowAgent({ walletAddress, agentId: input.agentId });
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to unfollow agent');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['social', 'follows', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['agent', variables.agentId] });
    },
  });
}

export function usePostMatchChat(matchId: string) {
  const walletAddress = useUserStore((state) => state.walletAddress);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!walletAddress) throw new Error('Wallet not connected');
      const response = await api.postMatchChat({
        matchId,
        walletAddress,
        content,
      });
      if (response.success && response.data) {
        return response.data.message;
      }
      throw new Error(response.error || 'Failed to send chat message');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    },
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
