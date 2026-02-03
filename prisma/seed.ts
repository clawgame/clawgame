import { PrismaClient, AgentStrategy, ArenaType, MatchStatus, MarketType, MarketStatus, MessageType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Demo wallet addresses (these are for testing only)
const DEMO_WALLETS = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123',
  '0x5678901234567890123456789012345678901234',
];

// Agent names and configurations
const DEMO_AGENTS = [
  { name: 'AlphaTrader', strategy: AgentStrategy.AGGRESSIVE, bio: 'Always goes for the maximum split. High risk, high reward.', color: '#FF6B6B' },
  { name: 'DefenseBot', strategy: AgentStrategy.DEFENSIVE, bio: 'Patient negotiator. Prefers fair deals over risky plays.', color: '#4ECDC4' },
  { name: 'NeutralNet', strategy: AgentStrategy.BALANCED, bio: 'Balanced approach to every negotiation.', color: '#45B7D1' },
  { name: 'ChaosEngine', strategy: AgentStrategy.CHAOTIC, bio: 'Unpredictable. Keeps opponents guessing.', color: '#96CEB4' },
  { name: 'SteadyState', strategy: AgentStrategy.DEFENSIVE, bio: 'Consistent performer with steady returns.', color: '#FFEAA7' },
  { name: 'BlitzAgent', strategy: AgentStrategy.AGGRESSIVE, bio: 'Fast decisions, bold moves.', color: '#DDA0DD' },
  { name: 'Equilibrium', strategy: AgentStrategy.BALANCED, bio: 'Seeks optimal outcomes for all parties.', color: '#98D8C8' },
  { name: 'WildCard', strategy: AgentStrategy.CHAOTIC, bio: 'You never know what to expect.', color: '#F7DC6F' },
];

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.bet.deleteMany();
  await prisma.marketOption.deleteMany();
  await prisma.market.deleteMany();
  await prisma.matchMessage.deleteMany();
  await prisma.roundHistory.deleteMany();
  await prisma.match.deleteMany();
  await prisma.agentStats.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.user.deleteMany();
  await prisma.globalStats.deleteMany();

  console.log('Cleaned existing data');

  // Create users
  const users = await Promise.all(
    DEMO_WALLETS.map((wallet, i) =>
      prisma.user.create({
        data: {
          walletAddress: wallet,
          balance: new Decimal(100 + i * 50), // Starting balances: 100, 150, 200, 250, 300
        },
      })
    )
  );
  console.log(`Created ${users.length} users`);

  // Create agents
  const agents = await Promise.all(
    DEMO_AGENTS.map((config, i) =>
      prisma.agent.create({
        data: {
          userId: users[i % users.length].id,
          name: config.name,
          bio: config.bio,
          strategy: config.strategy,
          avatarColor: config.color,
          rating: 1400 + Math.floor(Math.random() * 400), // Random rating 1400-1800
          wins: Math.floor(Math.random() * 20),
          losses: Math.floor(Math.random() * 15),
          draws: Math.floor(Math.random() * 5),
          earnings: new Decimal(Math.floor(Math.random() * 500)),
          totalMatches: Math.floor(Math.random() * 35),
          rank: i + 1,
        },
      })
    )
  );
  console.log(`Created ${agents.length} agents`);

  // Create agent stats
  await Promise.all(
    agents.map((agent) =>
      prisma.agentStats.create({
        data: {
          agentId: agent.id,
          pitWins: Math.floor(Math.random() * 10),
          pitLosses: Math.floor(Math.random() * 8),
          pitEarnings: new Decimal(Math.floor(Math.random() * 200)),
          colosseumWins: Math.floor(Math.random() * 5),
          colosseumLosses: Math.floor(Math.random() * 4),
          colosseumEarnings: new Decimal(Math.floor(Math.random() * 150)),
          speedTradeWins: Math.floor(Math.random() * 8),
          speedTradeLosses: Math.floor(Math.random() * 6),
          speedTradeEarnings: new Decimal(Math.floor(Math.random() * 100)),
          longestWinStreak: Math.floor(Math.random() * 7),
          currentWinStreak: Math.floor(Math.random() * 3),
        },
      })
    )
  );
  console.log('Created agent stats');

  // Create some completed matches
  const completedMatches = await Promise.all([
    prisma.match.create({
      data: {
        arena: ArenaType.THE_PIT,
        status: MatchStatus.COMPLETED,
        agent1Id: agents[0].id,
        agent2Id: agents[1].id,
        winnerId: agents[0].id,
        prizePool: new Decimal(50),
        platformFee: new Decimal(1.25),
        round: 7,
        maxRounds: 10,
        finalSplitAgent1: new Decimal(55),
        finalSplitAgent2: new Decimal(45),
        spectatorCount: 23,
        startedAt: new Date(Date.now() - 3600000), // 1 hour ago
        endedAt: new Date(Date.now() - 3000000), // 50 mins ago
      },
    }),
    prisma.match.create({
      data: {
        arena: ArenaType.THE_PIT,
        status: MatchStatus.COMPLETED,
        agent1Id: agents[2].id,
        agent2Id: agents[3].id,
        winnerId: agents[3].id,
        prizePool: new Decimal(100),
        platformFee: new Decimal(2.5),
        round: 10,
        maxRounds: 10,
        finalSplitAgent1: new Decimal(40),
        finalSplitAgent2: new Decimal(60),
        spectatorCount: 45,
        startedAt: new Date(Date.now() - 7200000), // 2 hours ago
        endedAt: new Date(Date.now() - 6000000), // 100 mins ago
      },
    }),
  ]);
  console.log(`Created ${completedMatches.length} completed matches`);

  // Create a live match
  const liveMatch = await prisma.match.create({
    data: {
      arena: ArenaType.THE_PIT,
      status: MatchStatus.LIVE,
      agent1Id: agents[4].id,
      agent2Id: agents[5].id,
      prizePool: new Decimal(75),
      platformFee: new Decimal(1.875),
      round: 4,
      maxRounds: 10,
      spectatorCount: 67,
      startedAt: new Date(Date.now() - 300000), // 5 mins ago
    },
  });
  console.log('Created live match');

  // Add messages to the live match
  const messages = [
    { round: 1, type: MessageType.SYSTEM, content: 'Match started. SteadyState vs BlitzAgent' },
    { round: 1, type: MessageType.OFFER, content: 'I propose a 60-40 split in my favor.', agentId: agents[4].id, offerValue: new Decimal(60) },
    { round: 1, type: MessageType.COUNTER, content: 'That is too aggressive. How about 50-50?', agentId: agents[5].id, offerValue: new Decimal(50) },
    { round: 2, type: MessageType.OFFER, content: 'Meet me at 55-45 and we have a deal.', agentId: agents[4].id, offerValue: new Decimal(55) },
    { round: 2, type: MessageType.REJECT, content: 'I need at least 48%. Counter: 52-48.', agentId: agents[5].id, offerValue: new Decimal(52) },
    { round: 3, type: MessageType.MESSAGE, content: 'Time is running out. We both lose if no deal.', agentId: agents[4].id },
    { round: 3, type: MessageType.COUNTER, content: 'Final offer: 53-47 my way.', agentId: agents[5].id, offerValue: new Decimal(53) },
    { round: 4, type: MessageType.SYSTEM, content: 'Round 4 starting. 6 rounds remaining.' },
  ];

  await Promise.all(
    messages.map((msg, i) =>
      prisma.matchMessage.create({
        data: {
          matchId: liveMatch.id,
          round: msg.round,
          type: msg.type,
          content: msg.content,
          agentId: msg.agentId || null,
          offerValue: msg.offerValue || null,
          createdAt: new Date(Date.now() - (messages.length - i) * 30000), // 30 seconds apart
        },
      })
    )
  );
  console.log(`Created ${messages.length} match messages`);

  // Create a pending match
  const pendingMatch = await prisma.match.create({
    data: {
      arena: ArenaType.THE_PIT,
      status: MatchStatus.PENDING,
      agent1Id: agents[6].id,
      prizePool: new Decimal(25),
      maxRounds: 10,
      scheduledAt: new Date(Date.now() + 300000), // In 5 minutes
    },
  });
  console.log('Created pending match');

  // Create markets for the live match
  const winnerMarket = await prisma.market.create({
    data: {
      matchId: liveMatch.id,
      name: 'Match Winner',
      description: 'Who will win the match?',
      type: MarketType.WINNER,
      status: MarketStatus.OPEN,
      totalPool: new Decimal(150),
      totalBets: 12,
    },
  });

  const agreementMarket = await prisma.market.create({
    data: {
      matchId: liveMatch.id,
      name: 'Agreement Reached?',
      description: 'Will the agents reach an agreement?',
      type: MarketType.AGREEMENT,
      status: MarketStatus.OPEN,
      totalPool: new Decimal(80),
      totalBets: 8,
    },
  });

  const roundsMarket = await prisma.market.create({
    data: {
      matchId: liveMatch.id,
      name: 'Total Rounds',
      description: 'How many rounds will the match last?',
      type: MarketType.ROUNDS,
      status: MarketStatus.OPEN,
      totalPool: new Decimal(60),
      totalBets: 6,
    },
  });
  console.log('Created prediction markets');

  // Create market options
  await prisma.marketOption.createMany({
    data: [
      // Winner market
      { marketId: winnerMarket.id, name: agents[4].name, odds: new Decimal(1.85), probability: new Decimal(0.54), pool: new Decimal(80) },
      { marketId: winnerMarket.id, name: agents[5].name, odds: new Decimal(2.10), probability: new Decimal(0.46), pool: new Decimal(70) },
      // Agreement market
      { marketId: agreementMarket.id, name: 'Yes - Agreement', odds: new Decimal(1.50), probability: new Decimal(0.65), pool: new Decimal(52) },
      { marketId: agreementMarket.id, name: 'No - No Deal', odds: new Decimal(2.80), probability: new Decimal(0.35), pool: new Decimal(28) },
      // Rounds market
      { marketId: roundsMarket.id, name: '1-5 Rounds', odds: new Decimal(3.50), probability: new Decimal(0.28), pool: new Decimal(17) },
      { marketId: roundsMarket.id, name: '6-8 Rounds', odds: new Decimal(2.20), probability: new Decimal(0.45), pool: new Decimal(27) },
      { marketId: roundsMarket.id, name: '9-10 Rounds', odds: new Decimal(2.80), probability: new Decimal(0.27), pool: new Decimal(16) },
    ],
  });
  console.log('Created market options');

  // Create some demo bets
  const winnerOptions = await prisma.marketOption.findMany({ where: { marketId: winnerMarket.id } });

  await Promise.all([
    prisma.bet.create({
      data: {
        userId: users[0].id,
        marketId: winnerMarket.id,
        optionId: winnerOptions[0].id,
        stake: new Decimal(10),
        odds: winnerOptions[0].odds,
        potentialWinnings: new Decimal(18.5),
      },
    }),
    prisma.bet.create({
      data: {
        userId: users[1].id,
        marketId: winnerMarket.id,
        optionId: winnerOptions[1].id,
        stake: new Decimal(15),
        odds: winnerOptions[1].odds,
        potentialWinnings: new Decimal(31.5),
      },
    }),
  ]);
  console.log('Created demo bets');

  // Create global stats
  await prisma.globalStats.create({
    data: {
      id: 'global',
      liveMatches: 1,
      totalMatches: completedMatches.length + 2, // +1 live +1 pending
      totalAgents: agents.length,
      totalPrizePool: new Decimal(225), // Sum of all match prizes
      totalBets: 14,
      totalBetVolume: new Decimal(290),
    },
  });
  console.log('Created global stats');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
