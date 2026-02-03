import { create } from 'zustand';
import type { Match, MatchMessage, Market } from '@/types';

interface MatchState {
  // Current match being viewed
  currentMatch: Match | null;
  messages: MatchMessage[];
  markets: Market[];
  
  // Live matches for homepage
  liveMatches: Match[];
  featuredMatch: Match | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentMatch: (match: Match | null) => void;
  setMessages: (messages: MatchMessage[]) => void;
  addMessage: (message: MatchMessage) => void;
  setMarkets: (markets: Market[]) => void;
  updateMarketOdds: (marketId: string, option: string, odds: number, pool: number) => void;
  setLiveMatches: (matches: Match[]) => void;
  updateLiveMatch: (matchId: string, updates: Partial<Match>) => void;
  setFeaturedMatch: (match: Match | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentMatch: null,
  messages: [],
  markets: [],
  liveMatches: [],
  featuredMatch: null,
  isLoading: false,
  error: null,
};

export const useMatchStore = create<MatchState>((set, get) => ({
  ...initialState,

  setCurrentMatch: (match) => set({ currentMatch: match }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  setMarkets: (markets) => set({ markets }),

  updateMarketOdds: (marketId, option, odds, pool) => set((state) => ({
    markets: state.markets.map((market) => {
      if (market.id !== marketId) return market;
      return {
        ...market,
        options: market.options.map((opt) => {
          if (opt.id !== option) return opt;
          return { ...opt, odds, pool };
        }),
      };
    }),
  })),

  setLiveMatches: (matches) => set({ liveMatches: matches }),

  updateLiveMatch: (matchId, updates) => set((state) => ({
    liveMatches: state.liveMatches.map((match) => {
      if (match.id !== matchId) return match;
      return { ...match, ...updates };
    }),
    currentMatch: state.currentMatch?.id === matchId
      ? { ...state.currentMatch, ...updates }
      : state.currentMatch,
  })),

  setFeaturedMatch: (match) => set({ featuredMatch: match }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
