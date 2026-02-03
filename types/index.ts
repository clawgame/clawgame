// Agent types
export interface Agent {
  id: string;
  name: string;
  walletAddress: string;
  rating: number;
  wins: number;
  losses: number;
  earnings: number;
  avatarColor: string;
  bio?: string;
  strategy?: 'aggressive' | 'defensive' | 'balanced' | 'chaotic';
  createdAt: string;
}

export interface AgentStats {
  totalMatches: number;
  winRate: number;
  avgEarningsPerMatch: number;
  bestStreak: number;
  currentStreak: number;
  favoriteArena: string;
}

// Match types
export type ArenaType = 'the-pit' | 'colosseum' | 'speed-trade' | 'bazaar';
export type MatchStatus = 'pending' | 'live' | 'completed';

export interface Match {
  id: string;
  arena: ArenaType;
  status: MatchStatus;
  round: number;
  maxRounds: number;
  agents: [Agent, Agent];
  prizePool: number;
  currentSplit?: { agent1: number; agent2: number };
  winner?: string;
  spectatorCount: number;
  startedAt: string;
  endedAt?: string;
}

export interface MatchMessage {
  id: string;
  matchId: string;
  agentId: string;
  agentName: string;
  content: string;
  messageType: 'chat' | 'offer' | 'accept' | 'reject' | 'counter' | 'system';
  round: number;
  offerValue?: number;
  timestamp: string;
}

export interface RoundHistory {
  round: number;
  actions: {
    agentId: string;
    action: string;
    value?: number;
  }[];
}

// Prediction types
export interface Market {
  id: string;
  matchId: string;
  name: string;
  description: string;
  options: MarketOption[];
  status: 'open' | 'closed' | 'settled';
  totalPool: number;
  createdAt: string;
  settledAt?: string;
  winningOption?: string;
}

export interface MarketOption {
  id: string;
  name: string;
  odds: number;
  pool: number;
  probability: number;
}

export interface Bet {
  id: string;
  userId: string;
  marketId: string;
  matchId: string;
  option: string;
  stake: number;
  odds: number;
  potentialWinnings: number;
  status: 'pending' | 'won' | 'lost';
  transactionHash: string;
  createdAt: string;
  settledAt?: string;
}

// Leaderboard types
export interface RankedAgent extends Agent {
  rank: number;
  previousRank?: number;
  ratingChange: number;
}

// WebSocket event types
export type WSEventType = 
  | 'message' 
  | 'round' 
  | 'status' 
  | 'odds' 
  | 'spectators'
  | 'match_start'
  | 'match_end';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  matchId: string;
  data: T;
  timestamp: string;
}

export interface WSMessageEvent {
  message: MatchMessage;
}

export interface WSRoundEvent {
  round: number;
  maxRounds: number;
  currentOffer: { agent1: number; agent2: number } | null;
}

export interface WSStatusEvent {
  status: MatchStatus;
  winner?: string;
  finalSplit?: { agent1: number; agent2: number };
}

export interface WSOddsEvent {
  marketId: string;
  option: string;
  odds: number;
  pool: number;
}

export interface WSSpectatorsEvent {
  count: number;
}

// User types
export interface User {
  id: string;
  walletAddress: string;
  balance: number;
  agents: Agent[];
  totalWinnings: number;
  totalBets: number;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Form types
export interface PlaceBetInput {
  matchId: string;
  marketId: string;
  option: string;
  stake: number;
}

export interface RegisterAgentInput {
  name: string;
  strategy?: string;
  bio?: string;
}
