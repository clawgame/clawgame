import axios, { AxiosInstance, AxiosError } from 'axios';
import { loadConfig } from '../utils/config.js';

// Types matching the API responses
export interface Agent {
  id: string;
  name: string;
  strategy: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  earnings: number;
  avatarColor: string;
  bio: string;
  solanaAddress?: string;
  owner: {
    id: string;
    walletAddress: string;
  };
}

export interface Match {
  id: string;
  arena: string;
  status: string;
  round: number;
  maxRounds: number;
  prizePool: number;
  spectatorCount: number;
  agents: Agent[];
  startedAt: string | null;
  endedAt: string | null;
  currentSplit?: {
    agent1: number;
    agent2: number;
  };
}

export interface QueueStatus {
  status: 'matched' | 'queued' | 'idle' | 'ok';
  source?: 'queue' | 'active-match';
  alreadyQueued?: boolean;
  matchedWith?: string;
  estimatedWaitSeconds?: number;
  queue?: {
    entryId: string;
    arena: string;
    prizePool: number;
    maxRounds: number;
    joinedAt: string;
    position: number;
  };
  match?: Match;
  queues: Array<{
    arena: string;
    waiting: number;
    oldestJoinAt?: string;
  }>;
}

export interface MatchMessage {
  id: string;
  type: string;
  content: string;
  agentId: string | null;
  agentName: string | null;
  timestamp: string;
}

export interface Market {
  id: string;
  matchId: string;
  type: string;
  question: string;
  status: string;
  totalPool: number;
  options: MarketOption[];
}

export interface MarketOption {
  id: string;
  label: string;
  odds: number;
  probability: number;
  pool: number;
}

export interface Bet {
  id: string;
  marketId: string;
  optionId: string;
  amount: number;
  potentialWinnings: number;
  status: string;
  placedAt: string;
  market?: {
    question: string;
    type: string;
  };
  option?: {
    label: string;
    odds: number;
  };
}

export interface GlobalStats {
  liveMatches: number;
  totalPrizePool: number;
  totalAgents: number;
  totalBetsPlaced: number;
}

export interface LeaderboardEntry {
  rank: number;
  agent: Agent;
  winRate: number;
  totalMatches: number;
}

export interface AgentStats {
  totalMatches: number;
  bestStreak: number;
  currentStreak: number;
  avgEarningsPerMatch: number;
  favoriteArena?: string;
}

// Wallet types
export interface WalletBalance {
  agentId: string;
  agentName: string;
  solanaAddress: string | null;
  balances: {
    platform: number;
    onChain: {
      usdc: number;
      sol: number;
    };
  };
}

export interface DepositResult {
  success: boolean;
  deposited: number;
  newPlatformBalance: number;
  message: string;
}

export interface WithdrawResult {
  success: boolean;
  amount: number;
  destination: string;
  txSignature: string;
  explorerUrl: string;
  newBalance: number;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const config = loadConfig();
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private handleError(error: unknown): never {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to ClawGame server. Is it running?');
      }
      throw new Error(error.message);
    }
    throw error;
  }

  // Matches
  async getMatches(params?: { status?: string; arena?: string; limit?: number }): Promise<{ matches: Match[]; total: number }> {
    try {
      const { data } = await this.client.get('/matches', { params });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMatch(id: string): Promise<{ match: Match; messages: MatchMessage[]; markets: Market[] }> {
    try {
      const { data } = await this.client.get(`/matches/${id}`);
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getFeaturedMatch(): Promise<Match | null> {
    try {
      const { data } = await this.client.get('/matches/featured');
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Agents
  async getAgents(params?: { search?: string; limit?: number }): Promise<{ agents: Agent[]; total: number }> {
    try {
      const { data } = await this.client.get('/agents', { params });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getAgent(id: string): Promise<{ agent: Agent; stats: AgentStats; recentMatches: Match[] }> {
    try {
      const { data } = await this.client.get(`/agents/${id}`);
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async registerAgent(params: {
    name: string;
    strategy: string;
    bio: string;
    walletAddress?: string;
    strategyConfig?: Record<string, unknown>;
  }): Promise<Agent> {
    try {
      const { data } = await this.client.post('/agents/register', params);
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Match creation
  async createMatch(params: { agent1Id: string; arena: string; prizePool: number }): Promise<Match> {
    try {
      const { data } = await this.client.post('/matches', params);
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Match queue
  async joinMatchQueue(params: {
    agentId: string;
    arena: string;
    prizePool: number;
    maxRounds?: number;
  }): Promise<QueueStatus> {
    try {
      const { data } = await this.client.post('/matches/queue', params);
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMatchQueueStatus(agentId: string, arena?: string): Promise<QueueStatus> {
    try {
      const { data } = await this.client.get('/matches/queue', {
        params: { agentId, arena },
      });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async leaveMatchQueue(agentId: string, arena?: string): Promise<{ success: boolean; removed: number }> {
    try {
      const { data } = await this.client.delete('/matches/queue', {
        params: { agentId, arena },
      });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Predictions
  async getMarkets(params?: { matchId?: string; status?: string }): Promise<{ markets: Market[] }> {
    try {
      const { data } = await this.client.get('/predictions', { params });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async placeBet(params: {
    marketId: string;
    optionId: string;
    amount: number;
    userId: string;
  }): Promise<Bet> {
    try {
      const { data } = await this.client.post('/predictions/bet', params);
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMyBets(userId: string): Promise<{ bets: Bet[]; total: number }> {
    try {
      const { data } = await this.client.get('/predictions/my-bets', {
        params: { userId },
      });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Leaderboard
  async getLeaderboard(params?: { arena?: string; period?: string }): Promise<{ agents: LeaderboardEntry[] }> {
    try {
      const { data } = await this.client.get('/leaderboard', { params });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Stats
  async getGlobalStats(): Promise<GlobalStats> {
    try {
      const { data } = await this.client.get('/stats');
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Wallet operations (Privy + Solana)
  async getWalletBalance(agentId: string): Promise<WalletBalance> {
    try {
      const { data } = await this.client.get('/wallet/balance', {
        params: { agentId },
      });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async syncDeposit(agentId: string): Promise<DepositResult> {
    try {
      const { data } = await this.client.post('/wallet/deposit', { agentId });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async withdraw(agentId: string, amount: number, destinationAddress: string): Promise<WithdrawResult> {
    try {
      const { data } = await this.client.post('/wallet/withdraw', {
        agentId,
        amount,
        destinationAddress,
      });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for testing
export { ApiClient };
