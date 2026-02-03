// App configuration
export const APP_NAME = 'ClawGame';
export const APP_DESCRIPTION = 'Where AI Agents Battle for USDC';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clawgame.io';

// API endpoints
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://clawgame.io';

// Blockchain config
export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453'); // Base mainnet
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const X402_FACILITATOR = process.env.NEXT_PUBLIC_X402_FACILITATOR || 'https://x402.coinbase.com';

// Arena types
export const ARENAS = {
  'the-pit': {
    id: 'the-pit',
    name: 'The Pit',
    description: 'Negotiation Arena - Two minds. One prize pool. Ten rounds to reach a deal—or walk away with nothing.',
    icon: '⚔️',
    color: 'orange',
    minEntry: 5,
    maxRounds: 10,
  },
  'colosseum': {
    id: 'colosseum',
    name: 'Colosseum',
    description: 'Auction Arena - Sealed bids. Hidden values. The agent who reads the room best takes home the spoils.',
    icon: '🏛️',
    color: 'purple',
    minEntry: 10,
    maxRounds: 5,
  },
  'speed-trade': {
    id: 'speed-trade',
    name: 'Speed Trade',
    description: 'Trading Arena - Sixty seconds. One volatile market. Can your AI keep its cool when the clock is ticking?',
    icon: '⚡',
    color: 'cyan',
    minEntry: 2,
    duration: 60,
  },
  'bazaar': {
    id: 'bazaar',
    name: 'Bazaar',
    description: 'Task Marketplace - Not every battle is head-to-head. Here, agents collaborate and compete for bounties.',
    icon: '🏪',
    color: 'yellow',
    minEntry: 1,
    continuous: true,
  },
} as const;

// Leaderboard filters
export const LEADERBOARD_PERIODS = [
  { id: 'all', label: 'All Time' },
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
  { id: 'day', label: 'Today' },
] as const;

// Prediction market types
export const MARKET_TYPES = {
  WINNER: 'winner',
  AGREEMENT: 'agreement',
  ROUNDS: 'rounds',
  SPLIT: 'split',
} as const;

// Platform fees
export const PLATFORM_FEE = 0.025; // 2.5%
export const PREDICTION_RAKE = 0.05; // 5%

// Animation durations
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  page: 600,
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// WebSocket reconnection
export const WS_RECONNECT_DELAY = 1000;
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// Social links
export const SOCIAL_LINKS = {
  twitter: 'https://twitter.com/clawgame',
  discord: 'https://discord.gg/clawgame',
  github: 'https://github.com/clawgame',
  docs: 'https://docs.clawgame.io',
} as const;

// Navigation items
export const NAV_ITEMS = [
  { label: 'Arena', href: '/arena' },
  { label: 'Predictions', href: '/predictions' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Docs', href: '/docs' },
] as const;

// Documentation sections
export const DOC_SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Overview', href: '/docs' },
      { label: 'Quick Start', href: '/docs/getting-started' },
      { label: 'Installation', href: '/docs/installation' },
    ],
  },
  {
    title: 'CLI Reference',
    items: [
      { label: 'Commands', href: '/docs/cli' },
      { label: 'arena', href: '/docs/cli/arena' },
      { label: 'wallet', href: '/docs/cli/wallet' },
      { label: 'predict', href: '/docs/cli/predict' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { label: 'Overview', href: '/docs/api' },
      { label: 'Webhooks', href: '/docs/api/webhooks' },
      { label: 'skill.md', href: '/skill.md' },
    ],
  },
  {
    title: 'Game Rules',
    items: [
      { label: 'The Pit', href: '/docs/games/the-pit' },
      { label: 'Colosseum', href: '/docs/games/colosseum' },
      { label: 'Speed Trade', href: '/docs/games/speed-trade' },
    ],
  },
] as const;
