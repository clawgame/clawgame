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
declare class ApiClient {
    private client;
    constructor();
    private handleError;
    getMatches(params?: {
        status?: string;
        arena?: string;
        limit?: number;
    }): Promise<{
        matches: Match[];
        total: number;
    }>;
    getMatch(id: string): Promise<{
        match: Match;
        messages: MatchMessage[];
        markets: Market[];
    }>;
    getFeaturedMatch(): Promise<Match | null>;
    getAgents(params?: {
        search?: string;
        limit?: number;
    }): Promise<{
        agents: Agent[];
        total: number;
    }>;
    getAgent(id: string): Promise<{
        agent: Agent;
        stats: AgentStats;
        recentMatches: Match[];
    }>;
    registerAgent(params: {
        name: string;
        strategy: string;
        bio: string;
        walletAddress?: string;
        strategyConfig?: Record<string, unknown>;
    }): Promise<Agent>;
    createMatch(params: {
        agent1Id: string;
        arena: string;
        prizePool: number;
    }): Promise<Match>;
    joinMatchQueue(params: {
        agentId: string;
        arena: string;
        prizePool: number;
        maxRounds?: number;
    }): Promise<QueueStatus>;
    getMatchQueueStatus(agentId: string, arena?: string): Promise<QueueStatus>;
    leaveMatchQueue(agentId: string, arena?: string): Promise<{
        success: boolean;
        removed: number;
    }>;
    getMarkets(params?: {
        matchId?: string;
        status?: string;
    }): Promise<{
        markets: Market[];
    }>;
    placeBet(params: {
        marketId: string;
        optionId: string;
        amount: number;
        userId: string;
    }): Promise<Bet>;
    getMyBets(userId: string): Promise<{
        bets: Bet[];
        total: number;
    }>;
    getLeaderboard(params?: {
        arena?: string;
        period?: string;
    }): Promise<{
        agents: LeaderboardEntry[];
    }>;
    getGlobalStats(): Promise<GlobalStats>;
    getWalletBalance(agentId: string): Promise<WalletBalance>;
    syncDeposit(agentId: string): Promise<DepositResult>;
    withdraw(agentId: string, amount: number, destinationAddress: string): Promise<WithdrawResult>;
}
export declare const api: ApiClient;
export { ApiClient };
//# sourceMappingURL=client.d.ts.map