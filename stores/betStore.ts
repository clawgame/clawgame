import { create } from 'zustand';

interface BetSelection {
  matchId: string;
  marketId: string;
  marketName: string;
  option: string;
  optionName: string;
  odds: number;
}

interface BetSlipState {
  // Selections
  selections: BetSelection[];
  stakes: Record<string, number>; // marketId -> stake amount
  
  // UI state
  isOpen: boolean;
  isProcessing: boolean;
  error: string | null;
  
  // Actions
  addSelection: (selection: BetSelection) => void;
  removeSelection: (marketId: string) => void;
  clearSelections: () => void;
  setStake: (marketId: string, stake: number) => void;
  setAllStakes: (stake: number) => void;
  setOpen: (open: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed
  getTotalStake: () => number;
  getPotentialWinnings: () => number;
}

export const useBetSlipStore = create<BetSlipState>((set, get) => ({
  selections: [],
  stakes: {},
  isOpen: false,
  isProcessing: false,
  error: null,

  addSelection: (selection) => {
    const { selections, stakes } = get();
    
    // Check if already selected
    const existingIndex = selections.findIndex(
      s => s.marketId === selection.marketId
    );

    if (existingIndex >= 0) {
      // Replace existing selection for same market
      const newSelections = [...selections];
      newSelections[existingIndex] = selection;
      set({ selections: newSelections, isOpen: true });
    } else {
      // Add new selection
      set({ 
        selections: [...selections, selection],
        stakes: { ...stakes, [selection.marketId]: 0 },
        isOpen: true,
      });
    }
  },

  removeSelection: (marketId) => {
    const { selections, stakes } = get();
    const newStakes = { ...stakes };
    delete newStakes[marketId];
    
    set({
      selections: selections.filter(s => s.marketId !== marketId),
      stakes: newStakes,
    });
  },

  clearSelections: () => set({
    selections: [],
    stakes: {},
    isOpen: false,
    error: null,
  }),

  setStake: (marketId, stake) => set((state) => ({
    stakes: { ...state.stakes, [marketId]: stake },
  })),

  setAllStakes: (stake) => set((state) => {
    const newStakes: Record<string, number> = {};
    state.selections.forEach(s => {
      newStakes[s.marketId] = stake;
    });
    return { stakes: newStakes };
  }),

  setOpen: (open) => set({ isOpen: open }),

  setProcessing: (processing) => set({ isProcessing: processing }),

  setError: (error) => set({ error }),

  getTotalStake: () => {
    const { stakes } = get();
    return Object.values(stakes).reduce((sum, stake) => sum + stake, 0);
  },

  getPotentialWinnings: () => {
    const { selections, stakes } = get();
    return selections.reduce((sum, selection) => {
      const stake = stakes[selection.marketId] || 0;
      return sum + (stake * selection.odds);
    }, 0);
  },
}));
