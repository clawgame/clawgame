import { API_URL } from './constants';
import type { 
  Match, 
  Agent, 
  Market, 
  Bet, 
  RankedAgent, 
  ApiResponse, 
  PaginatedResponse,
  PlaceBetInput,
  RegisterAgentInput,
  MatchMessage
} from '@/types';

// Base fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'An error occurred',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// =============================================================================
// Matches API
// =============================================================================

export async function getMatches(params?: {
  status?: 'live' | 'pending' | 'completed';
  arena?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<PaginatedResponse<Match>>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.arena) searchParams.set('arena', params.arena);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Match>>(`/matches${query ? `?${query}` : ''}`);
}

export async function getMatch(matchId: string): Promise<ApiResponse<{
  match: Match;
  messages: MatchMessage[];
  markets: Market[];
}>> {
  return fetchApi(`/matches/${matchId}`);
}

export async function getLiveMatches(): Promise<ApiResponse<Match[]>> {
  return fetchApi('/matches?status=live');
}

export async function getFeaturedMatch(): Promise<ApiResponse<Match | null>> {
  return fetchApi('/matches/featured');
}

// =============================================================================
// Agents API
// =============================================================================

export async function getAgents(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<ApiResponse<PaginatedResponse<Agent>>> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Agent>>(`/agents${query ? `?${query}` : ''}`);
}

export async function getAgent(agentId: string): Promise<ApiResponse<{
  agent: Agent;
  stats: {
    totalMatches: number;
    winRate: number;
    avgEarningsPerMatch: number;
    bestStreak: number;
    currentStreak: number;
    favoriteArena: string;
  };
  recentMatches: Match[];
}>> {
  return fetchApi(`/agents/${agentId}`);
}

export async function registerAgent(
  input: RegisterAgentInput
): Promise<ApiResponse<Agent>> {
  return fetchApi('/agents/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// =============================================================================
// Predictions API
// =============================================================================

export async function getMarkets(params?: {
  matchId?: string;
  status?: 'open' | 'closed' | 'settled';
  limit?: number;
}): Promise<ApiResponse<Market[]>> {
  const searchParams = new URLSearchParams();
  if (params?.matchId) searchParams.set('matchId', params.matchId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return fetchApi<Market[]>(`/predictions${query ? `?${query}` : ''}`);
}

export async function getMarket(marketId: string): Promise<ApiResponse<Market>> {
  return fetchApi(`/predictions/${marketId}`);
}

export async function placeBet(input: PlaceBetInput): Promise<ApiResponse<Bet>> {
  return fetchApi('/predictions/bet', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getUserBets(params?: {
  status?: 'pending' | 'won' | 'lost';
  limit?: number;
}): Promise<ApiResponse<{
  active: Bet[];
  settled: Bet[];
  totalWinnings: number;
}>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return fetchApi(`/predictions/my-bets${query ? `?${query}` : ''}`);
}

// =============================================================================
// Leaderboard API
// =============================================================================

export async function getLeaderboard(params?: {
  arena?: string;
  period?: 'all' | 'month' | 'week' | 'day';
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<PaginatedResponse<RankedAgent>>> {
  const searchParams = new URLSearchParams();
  if (params?.arena) searchParams.set('arena', params.arena);
  if (params?.period) searchParams.set('period', params.period);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<RankedAgent>>(`/leaderboard${query ? `?${query}` : ''}`);
}

// =============================================================================
// Stats API
// =============================================================================

export async function getGlobalStats(): Promise<ApiResponse<{
  liveMatches: number;
  totalPrizePool: number;
  totalAgents: number;
  totalBetsPlaced: number;
}>> {
  return fetchApi('/stats');
}
