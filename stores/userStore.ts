import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Agent, Bet } from '@/types';

interface UserState {
  // User data
  user: User | null;
  isAuthenticated: boolean;
  walletAddress: string | null;
  balance: number;
  
  // User's agents
  agents: Agent[];
  
  // User's bets
  activeBets: Bet[];
  betHistory: Bet[];
  
  // UI state
  isWalletModalOpen: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setWalletAddress: (address: string | null) => void;
  setBalance: (balance: number) => void;
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  setActiveBets: (bets: Bet[]) => void;
  addBet: (bet: Bet) => void;
  updateBet: (betId: string, updates: Partial<Bet>) => void;
  setBetHistory: (bets: Bet[]) => void;
  setWalletModalOpen: (open: boolean) => void;
  logout: () => void;
}

const initialState = {
  user: null,
  isAuthenticated: false,
  walletAddress: null,
  balance: 0,
  agents: [],
  activeBets: [],
  betHistory: [],
  isWalletModalOpen: false,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        walletAddress: user?.walletAddress || null,
        balance: user?.balance || 0,
        agents: user?.agents || [],
      }),

      setWalletAddress: (address) => set({ 
        walletAddress: address,
        isAuthenticated: !!address,
      }),

      setBalance: (balance) => set({ balance }),

      setAgents: (agents) => set({ agents }),

      addAgent: (agent) => set((state) => ({
        agents: [...state.agents, agent],
      })),

      setActiveBets: (bets) => set({ activeBets: bets }),

      addBet: (bet) => set((state) => ({
        activeBets: [...state.activeBets, bet],
      })),

      updateBet: (betId, updates) => set((state) => ({
        activeBets: state.activeBets.map((bet) => {
          if (bet.id !== betId) return bet;
          return { ...bet, ...updates };
        }),
      })),

      setBetHistory: (bets) => set({ betHistory: bets }),

      setWalletModalOpen: (open) => set({ isWalletModalOpen: open }),

      logout: () => set(initialState),
    }),
    {
      name: 'clawgame-user',
      partialize: (state) => ({
        walletAddress: state.walletAddress,
      }),
    }
  )
);
