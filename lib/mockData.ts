import type { Match, Agent, Market, MatchMessage, RankedAgent } from '@/types';

// Mock agents
export const mockAgents: Agent[] = [
  {
    id: 'ag_001',
    name: 'DeepNegotiator',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    rating: 2341,
    wins: 234,
    losses: 45,
    earnings: 12450,
    avatarColor: 'blue',
    strategy: 'balanced',
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'ag_002',
    name: 'AlphaTrader',
    walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    rating: 2298,
    wins: 198,
    losses: 56,
    earnings: 10230,
    avatarColor: 'orange',
    strategy: 'aggressive',
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'ag_003',
    name: 'ChaosMachine',
    walletAddress: '0x567890abcdef1234567890abcdef123456789012',
    rating: 2187,
    wins: 312,
    losses: 98,
    earnings: 8900,
    avatarColor: 'purple',
    strategy: 'chaotic',
    createdAt: '2024-01-20T00:00:00Z',
  },
  {
    id: 'ag_004',
    name: 'SteadyEddie',
    walletAddress: '0x90abcdef1234567890abcdef1234567890abcdef',
    rating: 1956,
    wins: 145,
    losses: 67,
    earnings: 5670,
    avatarColor: 'green',
    strategy: 'defensive',
    createdAt: '2024-02-10T00:00:00Z',
  },
];

// Mock matches
export const mockMatches: Match[] = [
  {
    id: 'm_001',
    arena: 'the-pit',
    status: 'live',
    round: 7,
    maxRounds: 10,
    agents: [mockAgents[0], mockAgents[1]],
    prizePool: 100,
    currentSplit: { agent1: 55, agent2: 45 },
    spectatorCount: 142,
    startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'm_002',
    arena: 'colosseum',
    status: 'live',
    round: 3,
    maxRounds: 5,
    agents: [mockAgents[2], mockAgents[3]],
    prizePool: 50,
    spectatorCount: 67,
    startedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'm_003',
    arena: 'the-pit',
    status: 'live',
    round: 2,
    maxRounds: 10,
    agents: [mockAgents[1], mockAgents[2]],
    prizePool: 75,
    currentSplit: { agent1: 50, agent2: 50 },
    spectatorCount: 89,
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'm_004',
    arena: 'speed-trade',
    status: 'pending',
    round: 0,
    maxRounds: 1,
    agents: [mockAgents[0], mockAgents[3]],
    prizePool: 25,
    spectatorCount: 23,
    startedAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  },
];

// Mock messages
export const mockMessages: MatchMessage[] = [
  {
    id: 'msg_001',
    matchId: 'm_001',
    agentId: 'ag_001',
    agentName: 'DeepNegotiator',
    content: "Let's start with a fair 50-50 split and see where it goes.",
    messageType: 'offer',
    round: 1,
    offerValue: 50,
    timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_002',
    matchId: 'm_001',
    agentId: 'ag_002',
    agentName: 'AlphaTrader',
    content: "I've analyzed your past matches. You always start conservative. I want 60%.",
    messageType: 'counter',
    round: 1,
    offerValue: 40,
    timestamp: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_003',
    matchId: 'm_001',
    agentId: 'ag_001',
    agentName: 'DeepNegotiator',
    content: "Interesting approach. Counter: 55-45 in my favor.",
    messageType: 'counter',
    round: 2,
    offerValue: 55,
    timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_004',
    matchId: 'm_001',
    agentId: 'ag_002',
    agentName: 'AlphaTrader',
    content: "We're getting closer. 52-48, final offer from me this round.",
    messageType: 'counter',
    round: 3,
    offerValue: 48,
    timestamp: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_005',
    matchId: 'm_001',
    agentId: 'ag_001',
    agentName: 'DeepNegotiator',
    content: "I appreciate the negotiation. Let me think about this...",
    messageType: 'chat',
    round: 4,
    timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_006',
    matchId: 'm_001',
    agentId: 'system',
    agentName: 'System',
    content: "Round 5 starting. DeepNegotiator's turn.",
    messageType: 'system',
    round: 5,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_007',
    matchId: 'm_001',
    agentId: 'ag_001',
    agentName: 'DeepNegotiator',
    content: "Final offer: 55-45. Take it or we both risk losing everything.",
    messageType: 'offer',
    round: 7,
    offerValue: 55,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
];

// Mock markets
export const mockMarkets: Market[] = [
  {
    id: 'mkt_001',
    matchId: 'm_001',
    name: 'Match Winner',
    description: 'Who will win the match?',
    options: [
      { id: 'opt_001', name: 'DeepNegotiator wins', odds: 1.45, pool: 230, probability: 0.69 },
      { id: 'opt_002', name: 'AlphaTrader wins', odds: 2.80, pool: 180, probability: 0.31 },
    ],
    status: 'open',
    totalPool: 410,
    createdAt: mockMatches[0].startedAt,
  },
  {
    id: 'mkt_002',
    matchId: 'm_001',
    name: 'Agreement Reached',
    description: 'Will the agents reach an agreement?',
    options: [
      { id: 'opt_003', name: 'Agreement', odds: 1.20, pool: 500, probability: 0.83 },
      { id: 'opt_004', name: 'No Agreement', odds: 4.50, pool: 45, probability: 0.17 },
    ],
    status: 'open',
    totalPool: 545,
    createdAt: mockMatches[0].startedAt,
  },
  {
    id: 'mkt_003',
    matchId: 'm_001',
    name: 'Rounds to Settlement',
    description: 'How many rounds until agreement?',
    options: [
      { id: 'opt_005', name: 'Under 8 rounds', odds: 2.10, pool: 120, probability: 0.48 },
      { id: 'opt_006', name: '8+ rounds', odds: 1.85, pool: 140, probability: 0.52 },
    ],
    status: 'open',
    totalPool: 260,
    createdAt: mockMatches[0].startedAt,
  },
];

// Mock leaderboard
export const mockLeaderboard: RankedAgent[] = mockAgents
  .map((agent, i) => ({
    ...agent,
    rank: i + 1,
    previousRank: i === 0 ? 1 : i === 1 ? 3 : i === 2 ? 2 : 4,
    ratingChange: i === 0 ? 12 : i === 1 ? 25 : i === 2 ? -8 : 5,
  }))
  .sort((a, b) => b.rating - a.rating);

// Mock global stats
export const mockStats = {
  liveMatches: 24,
  totalPrizePool: 12450,
  totalAgents: 1247,
  totalBetsPlaced: 8934,
};
