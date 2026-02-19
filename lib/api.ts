import { API_URL } from './constants';
import type { 
  Match, 
  Agent, 
  Market, 
  Bet, 
  ArenaType,
  RankedAgent, 
  ApiResponse, 
  PaginatedResponse,
  PlaceBetInput,
  RegisterAgentInput,
  MatchMessage,
  MatchQueueStatusResponse,
  Notification,
  Tournament,
  TournamentEntry,
  FollowedAgent,
  AgentSocial
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
  status?: 'live' | 'pending' | 'completed' | 'cancelled';
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

export async function joinMatchQueue(input: {
  agentId: string;
  arena?: ArenaType;
  prizePool?: number;
  maxRounds?: number;
}): Promise<ApiResponse<MatchQueueStatusResponse>> {
  return fetchApi('/matches/queue', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getMatchQueueStatus(params?: {
  agentId?: string;
  arena?: ArenaType;
}): Promise<ApiResponse<MatchQueueStatusResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.agentId) searchParams.set('agentId', params.agentId);
  if (params?.arena) searchParams.set('arena', params.arena);

  const query = searchParams.toString();
  return fetchApi<MatchQueueStatusResponse>(`/matches/queue${query ? `?${query}` : ''}`);
}

export async function leaveMatchQueue(input: {
  agentId: string;
  arena?: ArenaType;
}): Promise<ApiResponse<{ success: boolean; removed: number; queues: MatchQueueStatusResponse['queues'] }>> {
  const searchParams = new URLSearchParams();
  searchParams.set('agentId', input.agentId);
  if (input.arena) searchParams.set('arena', input.arena);

  const query = searchParams.toString();
  return fetchApi(`/matches/queue?${query}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// Agents API
// =============================================================================

export async function getAgents(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  walletAddress?: string;
}): Promise<ApiResponse<PaginatedResponse<Agent>>> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.walletAddress) searchParams.set('walletAddress', params.walletAddress);

  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Agent>>(`/agents${query ? `?${query}` : ''}`);
}

export async function getAgent(agentId: string, walletAddress?: string | null): Promise<ApiResponse<{
  agent: Agent;
  stats: {
    totalMatches: number;
    winRate: number;
    avgEarningsPerMatch: number;
    bestStreak: number;
    currentStreak: number;
    favoriteArena: string;
  };
  social: AgentSocial;
  recentMatches: Match[];
}>> {
  const params = new URLSearchParams();
  if (walletAddress) params.set('walletAddress', walletAddress);
  const query = params.toString();
  return fetchApi(`/agents/${agentId}${query ? `?${query}` : ''}`);
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
  walletAddress?: string;
  status?: 'pending' | 'won' | 'lost';
  limit?: number;
}): Promise<ApiResponse<{
  active: Bet[];
  settled: Bet[];
  totalWinnings: number;
}>> {
  const searchParams = new URLSearchParams();
  if (params?.walletAddress) searchParams.set('walletAddress', params.walletAddress);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return fetchApi(`/predictions/my-bets${query ? `?${query}` : ''}`);
}

// =============================================================================
// Notifications API
// =============================================================================

export async function getNotifications(params?: {
  walletAddress?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<{
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}>> {
  const searchParams = new URLSearchParams();
  if (params?.walletAddress) searchParams.set('walletAddress', params.walletAddress);
  if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  return fetchApi(`/notifications${query ? `?${query}` : ''}`);
}

export async function markNotificationRead(input: {
  walletAddress: string;
  notificationId: string;
}): Promise<ApiResponse<{ notification: Notification }>> {
  return fetchApi(`/notifications/${input.notificationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: input.walletAddress }),
  });
}

export async function markNotificationsRead(input: {
  walletAddress: string;
  ids?: string[];
}): Promise<ApiResponse<{ updated: number }>> {
  return fetchApi('/notifications', {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

// =============================================================================
// Tournaments API
// =============================================================================

export async function getTournaments(params?: {
  status?: 'open' | 'live' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<PaginatedResponse<Tournament>>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  const query = searchParams.toString();
  return fetchApi(`/tournaments${query ? `?${query}` : ''}`);
}

export async function getTournament(id: string): Promise<ApiResponse<{
  tournament: Tournament;
  entries: TournamentEntry[];
  rounds: Record<string, Match[]>;
  matches: Match[];
}>> {
  return fetchApi(`/tournaments/${id}`);
}

export async function createTournament(input: {
  name: string;
  arena: 'the-pit' | 'colosseum' | 'speed-trade' | 'bazaar';
  maxParticipants: number;
  walletAddress?: string;
  agentIds?: string[];
}): Promise<ApiResponse<{
  tournament: Tournament;
  entries: TournamentEntry[];
  matches: Match[];
}>> {
  return fetchApi('/tournaments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function joinTournament(input: {
  tournamentId: string;
  agentId: string;
}): Promise<ApiResponse<{
  entry: { id: string; tournamentId: string; agentId: string; seed: number };
  alreadyJoined: boolean;
  readyToStart: boolean;
}>> {
  return fetchApi(`/tournaments/${input.tournamentId}/join`, {
    method: 'POST',
    body: JSON.stringify({ agentId: input.agentId }),
  });
}

export async function startTournament(tournamentId: string): Promise<ApiResponse<{
  tournamentId: string;
  round: number;
  matchIds: string[];
}>> {
  return fetchApi(`/tournaments/${tournamentId}/start`, {
    method: 'POST',
  });
}

export async function syncTournament(tournamentId: string): Promise<ApiResponse<{
  status: 'open' | 'live' | 'completed' | 'cancelled' | string;
  advanced: boolean;
  completed?: boolean;
  winnerId?: string;
  round?: number;
  reason?: string;
  matchIds?: string[];
}>> {
  return fetchApi(`/tournaments/${tournamentId}/sync`, {
    method: 'POST',
  });
}

// =============================================================================
// Social API
// =============================================================================

export async function getFollowedAgents(walletAddress: string): Promise<ApiResponse<{
  items: FollowedAgent[];
  total: number;
}>> {
  return fetchApi(`/social/follows?walletAddress=${encodeURIComponent(walletAddress)}`);
}

export async function followAgent(input: {
  walletAddress: string;
  agentId: string;
}): Promise<ApiResponse<{ success: boolean; followerCount: number; isFollowing: boolean }>> {
  return fetchApi('/social/follows', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function unfollowAgent(input: {
  walletAddress: string;
  agentId: string;
}): Promise<ApiResponse<{ success: boolean; followerCount: number; isFollowing: boolean }>> {
  const params = new URLSearchParams({
    walletAddress: input.walletAddress,
    agentId: input.agentId,
  });
  return fetchApi(`/social/follows?${params.toString()}`, {
    method: 'DELETE',
  });
}

export async function getMatchChat(matchId: string): Promise<ApiResponse<{ items: MatchMessage[] }>> {
  return fetchApi(`/matches/${matchId}/chat`);
}

export async function postMatchChat(input: {
  matchId: string;
  walletAddress: string;
  content: string;
  senderName?: string;
}): Promise<ApiResponse<{ message: MatchMessage }>> {
  return fetchApi(`/matches/${input.matchId}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      content: input.content,
      senderName: input.senderName,
    }),
  });
}
