import { Decimal } from '@prisma/client/runtime/library';
import type {
  Agent as PrismaAgent,
  Match as PrismaMatch,
  Market as PrismaMarket,
  MarketOption as PrismaMarketOption,
  Bet as PrismaBet,
  MatchMessage as PrismaMatchMessage,
  AgentStrategy,
  ArenaType,
  MatchStatus,
  MarketStatus,
  MessageType,
  BetStatus
} from '@prisma/client';
import type {
  Agent,
  Match,
  Market,
  MarketOption,
  Bet,
  MatchMessage,
  RankedAgent,
  ArenaType as FrontendArenaType,
  MatchStatus as FrontendMatchStatus
} from '@/types';

// Type for Prisma agent with user relation
type AgentWithUser = PrismaAgent & {
  user: { walletAddress: string };
};

// Type for Prisma match with agent relations
type MatchWithAgents = PrismaMatch & {
  agent1: AgentWithUser;
  agent2: AgentWithUser | null;
};

// Type for Prisma market with options
type MarketWithOptions = PrismaMarket & {
  options: PrismaMarketOption[];
};

// Type for bet with market and option
type BetWithRelations = PrismaBet & {
  market: PrismaMarket & { match: { id: string } };
  option: PrismaMarketOption;
};

// =============================================================================
// Decimal Helpers
// =============================================================================

export function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

// =============================================================================
// Arena Type Mapping
// =============================================================================

const arenaTypeMap: Record<ArenaType, FrontendArenaType> = {
  THE_PIT: 'the-pit',
  COLOSSEUM: 'colosseum',
  SPEED_TRADE: 'speed-trade',
  BAZAAR: 'bazaar',
};

const reverseArenaTypeMap: Record<string, ArenaType> = {
  'the-pit': 'THE_PIT',
  'colosseum': 'COLOSSEUM',
  'speed-trade': 'SPEED_TRADE',
  'bazaar': 'BAZAAR',
};

export function toFrontendArena(arena: ArenaType): FrontendArenaType {
  return arenaTypeMap[arena];
}

export function toPrismaArena(arena: string): ArenaType | undefined {
  return reverseArenaTypeMap[arena];
}

// =============================================================================
// Status Mapping
// =============================================================================

const matchStatusMap: Record<MatchStatus, FrontendMatchStatus> = {
  PENDING: 'pending',
  LIVE: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'completed', // Map cancelled to completed for frontend
};

const reverseMatchStatusMap: Record<string, MatchStatus> = {
  'pending': 'PENDING',
  'live': 'LIVE',
  'completed': 'COMPLETED',
};

export function toFrontendMatchStatus(status: MatchStatus): FrontendMatchStatus {
  return matchStatusMap[status];
}

export function toPrismaMatchStatus(status: string): MatchStatus | undefined {
  return reverseMatchStatusMap[status];
}

const marketStatusMap: Record<MarketStatus, 'open' | 'closed' | 'settled'> = {
  OPEN: 'open',
  LOCKED: 'closed',
  SETTLED: 'settled',
  CANCELLED: 'settled',
};

export function toFrontendMarketStatus(status: MarketStatus): 'open' | 'closed' | 'settled' {
  return marketStatusMap[status];
}

const betStatusMap: Record<BetStatus, 'pending' | 'won' | 'lost'> = {
  PENDING: 'pending',
  WON: 'won',
  LOST: 'lost',
  CANCELLED: 'lost',
  REFUNDED: 'lost',
};

export function toFrontendBetStatus(status: BetStatus): 'pending' | 'won' | 'lost' {
  return betStatusMap[status];
}

// =============================================================================
// Strategy Mapping
// =============================================================================

const strategyMap: Record<AgentStrategy, 'aggressive' | 'defensive' | 'balanced' | 'chaotic'> = {
  AGGRESSIVE: 'aggressive',
  DEFENSIVE: 'defensive',
  BALANCED: 'balanced',
  CHAOTIC: 'chaotic',
};

const reverseStrategyMap: Record<string, AgentStrategy> = {
  'aggressive': 'AGGRESSIVE',
  'defensive': 'DEFENSIVE',
  'balanced': 'BALANCED',
  'chaotic': 'CHAOTIC',
};

export function toFrontendStrategy(strategy: AgentStrategy): 'aggressive' | 'defensive' | 'balanced' | 'chaotic' {
  return strategyMap[strategy];
}

export function toPrismaStrategy(strategy: string): AgentStrategy {
  return reverseStrategyMap[strategy] || 'BALANCED';
}

// =============================================================================
// Message Type Mapping
// =============================================================================

const messageTypeMap: Record<MessageType, 'chat' | 'offer' | 'accept' | 'reject' | 'counter' | 'system'> = {
  OFFER: 'offer',
  COUNTER: 'counter',
  ACCEPT: 'accept',
  REJECT: 'reject',
  MESSAGE: 'chat',
  SYSTEM: 'system',
};

export function toFrontendMessageType(type: MessageType): 'chat' | 'offer' | 'accept' | 'reject' | 'counter' | 'system' {
  return messageTypeMap[type];
}

// =============================================================================
// Format Functions
// =============================================================================

export function formatAgent(agent: AgentWithUser): Agent {
  return {
    id: agent.id,
    name: agent.name,
    walletAddress: agent.user.walletAddress,
    rating: agent.rating,
    wins: agent.wins,
    losses: agent.losses,
    earnings: toNumber(agent.earnings),
    avatarColor: agent.avatarColor,
    bio: agent.bio || undefined,
    strategy: toFrontendStrategy(agent.strategy),
    createdAt: agent.createdAt.toISOString(),
  };
}

export function formatRankedAgent(agent: AgentWithUser, index: number): RankedAgent {
  return {
    ...formatAgent(agent),
    rank: agent.rank || index + 1,
    previousRank: agent.previousRank || undefined,
    ratingChange: 0, // Could calculate from historical data
  };
}

export function formatMatch(match: MatchWithAgents): Match {
  const agent1 = formatAgent(match.agent1);

  // Create a placeholder agent2 if not assigned yet
  const agent2: Agent = match.agent2
    ? formatAgent(match.agent2)
    : {
        id: 'pending',
        name: 'Waiting...',
        walletAddress: '0x0',
        rating: 0,
        wins: 0,
        losses: 0,
        earnings: 0,
        avatarColor: '#666666',
        createdAt: new Date().toISOString(),
      };

  return {
    id: match.id,
    arena: toFrontendArena(match.arena),
    status: toFrontendMatchStatus(match.status),
    round: match.round,
    maxRounds: match.maxRounds,
    agents: [agent1, agent2],
    prizePool: toNumber(match.prizePool),
    currentSplit: match.finalSplitAgent1 && match.finalSplitAgent2
      ? {
          agent1: toNumber(match.finalSplitAgent1),
          agent2: toNumber(match.finalSplitAgent2)
        }
      : undefined,
    winner: match.winnerId || undefined,
    spectatorCount: match.spectatorCount,
    startedAt: match.startedAt?.toISOString() || match.createdAt.toISOString(),
    endedAt: match.endedAt?.toISOString(),
  };
}

export function formatMarketOption(option: PrismaMarketOption): MarketOption {
  return {
    id: option.id,
    name: option.name,
    odds: toNumber(option.odds),
    pool: toNumber(option.pool),
    probability: toNumber(option.probability),
  };
}

export function formatMarket(market: MarketWithOptions): Market {
  return {
    id: market.id,
    matchId: market.matchId,
    name: market.name,
    description: market.description || '',
    options: market.options.map(formatMarketOption),
    status: toFrontendMarketStatus(market.status),
    totalPool: toNumber(market.totalPool),
    createdAt: market.createdAt.toISOString(),
    settledAt: market.settledAt?.toISOString(),
    winningOption: market.winningOptionId || undefined,
  };
}

export function formatBet(bet: BetWithRelations): Bet {
  return {
    id: bet.id,
    userId: bet.userId,
    marketId: bet.marketId,
    matchId: bet.market.match.id,
    option: bet.option.name,
    stake: toNumber(bet.stake),
    odds: toNumber(bet.odds),
    potentialWinnings: toNumber(bet.potentialWinnings),
    status: toFrontendBetStatus(bet.status),
    transactionHash: `0x${bet.id.slice(0, 40)}`, // Generate pseudo tx hash
    createdAt: bet.createdAt.toISOString(),
    settledAt: bet.settledAt?.toISOString(),
  };
}

export function formatMatchMessage(
  message: PrismaMatchMessage,
  agentName?: string
): MatchMessage {
  return {
    id: message.id,
    matchId: message.matchId,
    agentId: message.agentId || 'system',
    agentName: agentName || 'System',
    content: message.content,
    messageType: toFrontendMessageType(message.type),
    round: message.round,
    offerValue: message.offerValue ? toNumber(message.offerValue) : undefined,
    timestamp: message.createdAt.toISOString(),
  };
}

// =============================================================================
// Generators
// =============================================================================

export function generateAvatarColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#00CED1', '#FF6347', '#32CD32', '#FF69B4',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function generateTransactionHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}
