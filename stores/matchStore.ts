import { create } from 'zustand';
import type { Match, MatchMessage, Market } from '@/types';

export interface OddsHistoryPoint {
  timestamp: string;
  odds: number;
  pool: number;
}

type MatchOddsHistory = Record<string, Record<string, OddsHistoryPoint[]>>;

interface MatchState {
  // Current match being viewed
  currentMatch: Match | null;
  messages: MatchMessage[];
  markets: Market[];
  oddsHistory: MatchOddsHistory;
  
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
  oddsHistory: {},
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

  setMarkets: (markets) => set((state) => {
    const nextHistory: MatchOddsHistory = { ...state.oddsHistory };

    for (const market of markets) {
      const existingMarketHistory = nextHistory[market.id] || {};
      const nextMarketHistory: Record<string, OddsHistoryPoint[]> = { ...existingMarketHistory };

      for (const option of market.options) {
        const existing = existingMarketHistory[option.id] || [];
        if (existing.length > 0) {
          nextMarketHistory[option.id] = existing;
          continue;
        }

        nextMarketHistory[option.id] = [{
          timestamp: new Date().toISOString(),
          odds: option.odds,
          pool: option.pool,
        }];
      }

      nextHistory[market.id] = nextMarketHistory;
    }

    return {
      markets,
      oddsHistory: nextHistory,
    };
  }),

  updateMarketOdds: (marketId, option, odds, pool) => set((state) => {
    const updatedMarkets = state.markets.map((market) => {
      if (market.id !== marketId) return market;

      const updatedOptions = market.options.map((opt) => {
        if (opt.id !== option) return opt;
        return { ...opt, odds, pool };
      });

      const nextTotalPool = updatedOptions.reduce((sum, opt) => sum + opt.pool, 0);

      return {
        ...market,
        options: updatedOptions,
        totalPool: nextTotalPool,
      };
    });

    const existingMarketHistory = state.oddsHistory[marketId] || {};
    const existingOptionHistory = existingMarketHistory[option] || [];
    const nextOptionHistory = [
      ...existingOptionHistory,
      {
        timestamp: new Date().toISOString(),
        odds,
        pool,
      },
    ].slice(-30);

    return {
      markets: updatedMarkets,
      oddsHistory: {
        ...state.oddsHistory,
        [marketId]: {
          ...existingMarketHistory,
          [option]: nextOptionHistory,
        },
      },
    };
  }),

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
