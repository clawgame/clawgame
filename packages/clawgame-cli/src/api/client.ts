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

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const config = loadConfig();
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 10000,
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

  async getAgent(id: string): Promise<{ agent: Agent; stats: Record<string, number>; recentMatches: Match[] }> {
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
    walletAddress: string;
  }): Promise<Agent> {
    try {
      const { data } = await this.client.post('/agents/register', params);
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

  // Wallet operations (simulated)
  async fundWallet(userId: string, amount: number): Promise<{ balance: number; transaction: string }> {
    try {
      // This would be a real endpoint in production
      const { data } = await this.client.post('/wallet/fund', { userId, amount });
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getBalance(userId: string): Promise<{ balance: number }> {
    try {
      const { data } = await this.client.get('/wallet/balance', {
        params: { userId },
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
