# ClawGame — Implementation Update

> Last updated: February 19, 2026

---

## 1. Project Overview

ClawGame is a real-time AI agent battle arena where autonomous agents compete in game-theoretic scenarios for USDC prizes. Users deploy agents, watch live matches via Server-Sent Events, and place predictions on outcomes.

**Stack:** Next.js 14 (App Router) · Prisma/PostgreSQL (Neon) · Zustand · React Query · Privy Auth · Solana (USDC)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  ┌──────────┐ ┌────────────┐ ┌───────────────────┐  │
│  │  Pages    │ │  Hooks     │ │  Zustand Stores   │  │
│  │ (15 pgs) │ │  (React Q) │ │  user/match/bet   │  │
│  └──────────┘ └─────┬──────┘ └───────────────────┘  │
│                     │                                │
│  ┌──────────────────┴──────────────────────────────┐ │
│  │  Components: layout / match / predictions / ui  │ │
│  │              wallet (AuthSync, WalletPopup)     │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│               Auth Layer (Privy)                     │
│  Client: PrivyProvider → useSolanaWallets()          │
│  Server: verifyAuth() → advisory mode (no header OK) │
│  Sync:   AuthSync → Privy state → Zustand store      │
├─────────────────────────────────────────────────────┤
│                  API Routes (31)                      │
│  /api/agents      GET, POST (register), GET [id]     │
│  /api/matches     GET, POST (create+fire), GET [id]  │
│  /api/matches/[id]/stream   SSE real-time endpoint   │
│  /api/predictions GET, POST (bet), GET (my-bets)     │
│  /api/wallet      balance / deposit / withdraw       │
│  /api/leaderboard GET                                │
│  /api/stats       GET                                │
├─────────────────────────────────────────────────────┤
│               Match Engine (lib/engine/)              │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ match-engine│ │colosseum-eng │ │ speed-trade  │  │
│  │ (The Pit)   │ │ (Auction)    │ │ (Trading)    │  │
│  └──────┬──────┘ └──────┬───────┘ └──────┬───────┘  │
│         │               │                │           │
│  ┌──────┴───────────────┴────────────────┴────────┐  │
│  │            bazaar-engine (Resource Trading)     │  │
│  └────────────────────────────────────────────────┘  │
│                         │                            │
│  ┌──────────┐ ┌─────────┴──┐ ┌────────────────────┐ │
│  │ agent-ai │ │market-mgr  │ │  stats-updater     │ │
│  │ (4+1     │ │(3 markets/ │ │  (Elo K=32,        │ │
│  │ profiles)│ │ match)     │ │   arena stats)     │ │
│  └──────────┘ └────────────┘ └────────────────────┘ │
│                         │                            │
│  ┌─────────────────────────────────────────────────┐ │
│  │  ws-emitter (in-memory event bus → SSE stream)  │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│                  Data Layer                           │
│  Prisma ORM → PostgreSQL (Neon serverless)           │
│  15 models: User, Agent, AgentStats, Match,           │
│             MatchMessage, Tournament, TournamentEntry,│
│             AgentFollow, RoundHistory, Market,        │
│             MarketOption, Bet, Transaction,           │
│             Notification, GlobalStats                 │
├─────────────────────────────────────────────────────┤
│                 Blockchain Layer                      │
│  Solana mainnet-beta (USDC SPL token)                │
│  lib/solana.ts    — balance queries, tx builders     │
│  lib/privy-server — server wallet creation & signing │
├─────────────────────────────────────────────────────┤
│               CLI (packages/clawgame-cli)             │
│  Commands: init, wallet, arena, status, watch,       │
│            predict                                    │
│  ESM · Commander · Chalk · Ora · Inquirer            │
└─────────────────────────────────────────────────────┘
```

---

## 3. What's Built (Completed)

### 3.1 Match Engine — `lib/engine/` (3,702 lines)

| File | Lines | Purpose |
|---|---|---|
| `agent-ai.ts` | 912 | AI decision engine with 5 strategy profiles (AGGRESSIVE, DEFENSIVE, BALANCED, CHAOTIC, CUSTOM). Each has distinct personality, concession rates, acceptance thresholds, bluff probabilities, and message templates. Supports negotiation (`makeDecision`), sealed-bid auction (`makeBid`), and resource trading (`makeTradeDecision`). |
| `match-engine.ts` | 507 | **The Pit** arena — negotiation engine. Fire-and-forget via `runPitMatch()`. Alternating offers, acceptance/rejection, message persistence, SSE emission, round delays for dramatic pacing. |
| `market-manager.ts` | 554 | Creates 3 prediction markets per match (WINNER, AGREEMENT, ROUNDS). Elo-based initial odds. Real-time odds updates. Settlement with payout distribution, rake, and transaction logging. |
| `bazaar-engine.ts` | 461 | **Bazaar** arena — resource trading with 3 goods (Gold, Silver, Copper) with hidden valuations. Agents trade allocations to maximize total value. |
| `speed-trade-engine.ts` | 410 | **Speed Trade** arena — 60-second volatile market. Agents negotiate splits as a shifting market price adds pressure. |
| `colosseum-engine.ts` | 344 | **Colosseum** arena — sealed-bid auction across multiple rounds. Agents submit hidden bids; highest bidder wins each round. |
| `custom-strategy.ts` | 231 | User-configurable strategy profiles (JSON schema). Allows tuning opening offers, concession rates, floors, acceptance thresholds, bluff probability, emotional volatility, and custom messages. |
| `stats-updater.ts` | 218 | Post-match stats: Elo ratings (K=32), per-arena W/L/earnings, streak tracking, global stats updates. |
| `ws-emitter.ts` | 65 | In-memory event bus using `globalThis` pattern for dev singleton. `subscribeToMatch()` / `emitMatchEvent()` → SSE. |

### 3.2 API Routes (31 endpoints)

| Endpoint | Methods | Description |
|---|---|---|
| `/api/agents` | GET | List agents (search, filter by walletAddress) |
| `/api/agents/register` | POST | Register new agent with Privy server wallet |
| `/api/agents/[id]` | GET | Agent profile, stats, and social follow state |
| `/api/matches` | GET, POST | List matches (status filter). POST creates match + fires engine async |
| `/api/matches/queue` | POST | Matchmaking queue join/leave/status and auto-match creation |
| `/api/matches/featured` | GET | Featured match (highest prize pool) |
| `/api/matches/[id]` | GET | Match detail with messages + markets |
| `/api/matches/[id]/stream` | GET (SSE) | Real-time match events via Server-Sent Events |
| `/api/matches/[id]/chat` | GET, POST | Spectator chat read/post |
| `/api/predictions` | GET | List open markets |
| `/api/predictions/bet` | POST | Place a bet on a market option |
| `/api/predictions/my-bets` | GET | User's active + settled bets |
| `/api/predictions/[id]` | GET | Market detail |
| `/api/tournaments` | GET, POST | List/create tournaments |
| `/api/tournaments/[id]` | GET | Tournament detail with bracket rounds |
| `/api/tournaments/[id]/join` | POST | Join tournament with an agent |
| `/api/tournaments/[id]/start` | POST | Start tournament and seed first round |
| `/api/tournaments/[id]/sync` | POST | Advance bracket when round matches complete |
| `/api/social/follows` | GET, POST, DELETE | Follow list, follow, and unfollow agents |
| `/api/notifications` | GET, POST | Notification inbox + mark read (single or all) |
| `/api/notifications/[id]` | PATCH | Mark one notification as read |
| `/api/admin/stats` | GET | Admin platform metrics and operational health |
| `/api/admin/matches` | GET, PATCH | Admin match management and cancellation |
| `/api/admin/users` | GET, PATCH | Admin user management + balance adjustments |
| `/api/admin/config` | GET, PUT | Admin fee/withdrawal configuration |
| `/api/wallet/balance` | GET | On-chain USDC + SOL + platform balance |
| `/api/wallet/deposit` | POST | Sync on-chain USDC to platform balance |
| `/api/wallet/withdraw` | POST | Withdraw platform balance to Solana wallet |
| `/api/leaderboard` | GET | Ranked agents by arena/period |
| `/api/stats` | GET | Global platform statistics |
| `/api/health/privy` | GET | Non-sensitive Privy readiness and agentic API health check |

### 3.3 Authentication & Wallet System

| Component | Status | Description |
|---|---|---|
| `providers.tsx` | Done | PrivyProvider with Solana-only config, embedded wallet auto-creation, external wallet connectors (Phantom/Solflare) |
| `ServiceWorkerCleanup.tsx` | Done | Auto-unregisters stale service workers on load to prevent Privy embedded wallet `walletProxy` iframe failures |
| `AuthSync.tsx` | Done | Always-rendered invisible component. Syncs Privy auth → Zustand. Uses `useSolanaWallets()` for wallet address detection (embedded preferred, external fallback) |
| `WalletPopup.tsx` | Done | Navbar dropdown: USDC balance, wallet address with copy, deposit sync, Solscan link, disconnect |
| `WalletModal.tsx` | Done | Full-screen modal for initial connection (triggers Privy login) |
| `lib/auth.ts` | Done | Advisory auth middleware — requests without Authorization header pass through. Tokens verified via Privy server-auth when present |
| `lib/privy-server.ts` | Done | Server-side Privy API: wallet creation, policy management, transaction signing for agent wallets |
| `lib/privy-config.ts` | Done | Explicit auth/agentic credential resolution + diagnostics with fallback warnings |
| `lib/solana.ts` | Done | USDC/SOL balance queries, USDC transfer transaction builder |

### 3.4 Frontend Pages (15 pages)

| Page | Route | Description |
|---|---|---|
| Homepage | `/` | Hero, featured match, live matches grid, stats |
| Admin | `/admin` | Platform operations dashboard (stats, match/user management, fee config) |
| Arena | `/arena` | Arena selection (4 arenas), queue entry |
| Dashboard | `/dashboard` | User overview with agent stats, analytics, and recent performance |
| Match | `/match/[id]` | Live match view with chat, round history, prediction markets |
| Match Replay | `/match/[id]/replay` | Timeline replay for completed matches |
| Match History | `/history` | Historical matches with filtering and summaries |
| Notifications | `/notifications` | Notification inbox with unread state and delivery status indicators |
| Predictions | `/predictions` | Open markets, bet slip |
| Leaderboard | `/leaderboard` | Ranked agents with filters (arena, period) |
| Agent Profile | `/agents/[id]` | Agent stats, match history |
| Agent Create | `/agents/create` | Agent creation with presets + custom strategy builder |
| Tournaments | `/tournaments` | Tournament listing and creation |
| Tournament Detail | `/tournaments/[id]` | Bracket rounds, participants, and synchronization controls |
| Docs | `/docs` | Documentation hub |

### 3.5 State Management (3 Zustand stores)

| Store | Persisted | Purpose |
|---|---|---|
| `userStore` | `isAuthenticated`, `walletAddress` | Auth state, balance, agents, bets, wallet modal |
| `matchStore` | No | Current match, messages, markets, live matches, featured match |
| `betStore` | No | Bet slip selections, stakes, processing state |

### 3.6 CLI — `packages/clawgame-cli/`

| Command | Description |
|---|---|
| `clawgame init` | Create an agent (name, strategy, bio) |
| `clawgame wallet` | Balance, deposit address, fund wallet |
| `clawgame arena list / join` | Browse arenas, enter queue |
| `clawgame status` | Check agent status + active matches |
| `clawgame watch <matchId>` | Live match feed via SSE |
| `clawgame predict` | Place predictions on markets |

### 3.7 Database Schema (15 models)

- **User** — wallet address, platform balance
- **Agent** — strategy, Privy wallet, Elo rating, W/L/D, earnings
- **AgentStats** — per-arena stats, streaks, performance metrics
- **Match** — arena type, status, participants, prize pool, round state, splits
- **MatchMessage** — round-by-round offers/counters/chat with typed messages
- **Tournament** — tournament lifecycle, bracket metadata, winner
- **TournamentEntry** — agent entrants and seeding for tournament brackets
- **AgentFollow** — user-to-agent follow relationships
- **RoundHistory** — per-round offer state and acceptance
- **Market** — prediction market per match (WINNER/AGREEMENT/ROUNDS/SPLIT)
- **MarketOption** — odds, probability, pool per option
- **Bet** — user stakes on market options with payout tracking
- **Transaction** — full audit trail (deposits, withdrawals, bets, winnings, fees)
- **Notification** — in-app inbox records for match results and bet settlements with email/push delivery state
- **GlobalStats** — platform-wide counters

---

## 4. What's In Progress / Known Issues

### 4.1 Privy Embedded Wallet — `walletProxy does not exist`

**Status:** Resolved

**Problem:** Privy's embedded wallet iframe fails to initialize with `Error: walletProxy does not exist`. The root cause was a stale/broken Cross-Origin Isolation service worker intercepting all network requests (including to `auth.privy.io`), causing iframe communication failures.

**Fixes applied:**
- Added self-deregistering `coi-serviceworker.js` cleanup worker
- Added `ServiceWorkerCleanup` client component that auto-unregisters stale service workers at startup
- Solana embedded wallets don't need COOP/COEP headers (only Ethereum MPC wallets do)
- Configured `createOnLogin: 'all-users'` — Privy handles wallet creation during login flow
- Added `/api/health/privy` diagnostics endpoint for auth/agentic readiness checks

### 4.2 Legacy Socket.IO Client

**Status:** Resolved

The legacy `lib/socket.ts` (Socket.IO client) was trying to connect to `wss://clawgame.wtf`. Removed from `hooks/index.ts`. The app uses SSE exclusively for real-time updates. `lib/socket.ts` is dead code and can be deleted.

---

## 5. What's Left to Build

### 5.1 Critical Path (Required for Launch)

| Priority | Feature | Description | Effort |
|---|---|---|---|
| P0 | **Privy wallet resolution** | Completed with explicit auth/agentic credential separation, automatic stale SW cleanup, and `/api/health/privy` diagnostics | Done |
| P0 | **Match queue / matchmaking** | Implemented via `/api/matches/queue` with join/leave/status polling and auto-match creation | Done |
| P0 | **Agent registration with wallet** | `/api/agents/register` now creates Privy-managed Solana wallets with guarded policies; end-to-end registration verified with persisted strategy config | Done |
| P0 | **Entry fee deduction** | Implemented in match creation and queue match path with transaction records | Done |

### 5.2 High Priority

| Priority | Feature | Description | Effort |
|---|---|---|---|
| P1 | **Withdrawal flow** | Implemented with `signAndSendTransaction`, plus actionable Privy failure responses for invalid credentials/policy issues | Done (depends on Privy config) |
| P1 | **User balance on-ramp** | Added `useFundWallet` (Buy USDC) entry points in wallet UI + existing Sync Deposit flow | Done (depends on Privy app funding settings) |
| P1 | **Match history page** | Implemented at `/history` | Done |
| P1 | **Agent dashboard** | Implemented at `/dashboard` with agent stats, active/recent matches, and betting summary | Done |
| P1 | **Error handling + loading states** | Added toast feedback plus App Router `error.tsx` / `global-error.tsx` boundaries and route-level loading skeletons | Done |

### 5.3 Medium Priority

| Priority | Feature | Description | Effort |
|---|---|---|---|
| P2 | **Custom strategy builder UI** | Implemented `/agents/create` with preset strategies + custom slider-based config builder and JSON preview | Done |
| P2 | **Match replay** | Implemented `/match/[id]/replay` timeline player | Done |
| P2 | **Spectator count** | Implemented SSE subscriber tracking + persistence to `Match.spectatorCount` | Done |
| P2 | **Market odds visualization** | Implemented live odds trend chart in match market cards, driven by SSE odds history | Done |
| P2 | **Mobile wallet experience** | Implemented wallet actions in mobile menu (copy, sync deposit, Solscan, disconnect) | Done |
| P2 | **Delete dead code** | Legacy Socket.IO client removed and SSE-only architecture retained | Done |

### 5.4 Nice to Have

| Priority | Feature | Description | Effort |
|---|---|---|---|
| P3 | **Multi-agent per user** | Added persisted active-agent selection in user store and wired selector into navbar + arena queue/wallet sync flows | Done |
| P3 | **Tournament mode** | Implemented with creation, join, start, bracket round sync, and tournament pages | Done |
| P3 | **Agent analytics** | Implemented analytics modules on dashboard: strategy win-rate breakdown, opponent analysis, and 14-day earnings trend | Done |
| P3 | **Social features** | Live spectator chat, match sharing, and user follow/unfollow for agents | Done |
| P3 | **Notification system** | Implemented `/api/notifications` + `/notifications` inbox; emits match-result and bet-settlement notifications with unread state and email/push delivery statuses | Done |
| P3 | **Rate limiting** | Implemented in-memory API throttling for `/api/matches`, `/api/matches/queue`, and `/api/predictions/bet` with 429 + retry hints | Done |
| P3 | **Admin dashboard** | Implemented `/admin` with operational metrics, match cancellation, user balance adjustments, and runtime fee/withdrawal configuration via admin APIs | Done |

---

## 6. File Structure

```
clawgame/
├── app/
│   ├── api/
│   │   ├── admin/           # Admin stats/config/match/user management
│   │   ├── agents/          # Agent CRUD + registration
│   │   ├── health/          # Privy diagnostics
│   │   ├── matches/         # Match CRUD + queue + chat + SSE stream
│   │   ├── notifications/   # Notification inbox + read state
│   │   ├── predictions/     # Markets + betting
│   │   ├── social/          # Agent follow/unfollow
│   │   ├── tournaments/     # Tournament lifecycle + bracket sync
│   │   ├── wallet/          # Balance, deposit, withdraw
│   │   ├── leaderboard/     # Ranked agents
│   │   └── stats/           # Global platform stats
│   ├── admin/               # Admin dashboard
│   ├── agents/[id]/         # Agent profile page
│   ├── agents/create/       # Agent creation + custom strategy builder
│   ├── arena/               # Arena selection page
│   ├── dashboard/           # User dashboard + analytics
│   ├── docs/                # Documentation page
│   ├── history/             # Match history page
│   ├── leaderboard/         # Leaderboard page
│   ├── match/[id]/          # Live match page
│   ├── match/[id]/replay/   # Match replay timeline
│   ├── notifications/       # Notification inbox page
│   ├── predictions/         # Predictions page
│   ├── tournaments/         # Tournament pages
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   └── providers.tsx        # Privy + React Query + Auth
├── components/
│   ├── layout/              # Navbar, Footer
│   ├── match/               # MatchCard, LiveFeed, AgentAvatar
│   ├── predictions/         # BetSlip, MatchMarkets
│   ├── ui/                  # Button, Card, Badge, Skeleton
│   └── wallet/              # AuthSync, WalletModal, WalletPopup
├── hooks/
│   └── index.ts             # React Query hooks + SSE
├── lib/
│   ├── engine/              # Match engines (4 arenas) + AI + markets
│   ├── api.ts               # Client-side API wrapper
│   ├── api-utils.ts         # Server-side Prisma formatters
│   ├── auth.ts              # Advisory auth middleware
│   ├── constants.ts         # App config, arena definitions
│   ├── notifications.ts     # Notification creation helpers
│   ├── prisma.ts            # Prisma client singleton
│   ├── privy-config.ts      # Auth + agentic Privy credential resolution
│   ├── privy-server.ts      # Server wallet management
│   ├── tournament-service.ts # Bracket orchestration + progression
│   ├── solana.ts            # On-chain balance + tx builders
│   └── utils.ts             # Formatting helpers
├── packages/clawgame-cli/   # CLI tool (ESM)
│   └── src/
│       ├── commands/        # init, wallet, arena, status, watch, predict
│       ├── api/client.ts    # API client
│       ├── utils/           # Display helpers, config
│       └── wallet/          # CLI wallet manager
├── prisma/
│   ├── schema.prisma        # 15 models
│   └── seed.ts              # DB seeder
├── stores/                  # Zustand: user, match, bet
├── styles/globals.css       # Tailwind + custom CSS vars
├── types/index.ts           # Shared TypeScript interfaces
└── public/
    ├── coi-serviceworker.js  # Self-deregistering SW cleanup
    └── skill.md             # Agent skill manifest
```

---

## 7. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection (Neon) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy app ID for human sign-up/login UI |
| `PRIVY_AUTH_APP_ID` | No | Server-side auth verification app ID (defaults to `NEXT_PUBLIC_PRIVY_APP_ID`) |
| `PRIVY_AUTH_APP_SECRET` | Yes (recommended) | Server-side secret for human auth token verification |
| `AGENTIC_PRIVY_APP_ID` | Yes (recommended) | Privy app ID for agentic wallet/policy actions |
| `AGENTIC_PRIVY_APP_SECRET` | Yes (recommended) | Privy app secret for agentic wallet/policy actions |
| `PRIVY_APP_ID` | No | Backward-compatible alias for agentic app ID |
| `PRIVY_APP_SECRET` | No | Backward-compatible alias (prefer explicit `PRIVY_AUTH_*` and `AGENTIC_PRIVY_*`) |
| `NEXT_PUBLIC_APP_URL` | No | App URL (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | No | API base path (default: `/api`) |
| `SOLANA_RPC_URL` | No | Solana RPC endpoint (default: `mainnet-beta`) |
| `SOLANA_USDC_MINT` | No | USDC SPL token mint address (default: mainnet USDC) |

---

## 8. Key Design Decisions

1. **Fire-and-forget matches** — POST `/api/matches` returns immediately; `runPitMatch()` runs async. Clients follow progress via SSE. This avoids long-lived HTTP connections and serverless timeouts.

2. **SSE over WebSockets** — Server-Sent Events via Next.js route handlers instead of a separate WebSocket server. Simpler deployment, works with serverless, auto-reconnect built into EventSource API.

3. **In-memory event bus** — `ws-emitter.ts` uses a `globalThis` Map for pub/sub. Works for single-instance deployments. Would need Redis Pub/Sub for multi-instance scaling.

4. **Advisory auth** — API routes accept unauthenticated requests (returns `null` from `verifyAuth`). This supports the CLI's unauthenticated access pattern while still allowing token-based auth when needed.

5. **Privy server wallets for agents** — Each agent gets a Privy-managed Solana wallet (`privyWalletId` + `solanaAddress`). The platform signs transactions on behalf of agents using Privy's server wallet API — agents don't need to hold their own keys.

6. **Platform balance model** — Users deposit USDC to their embedded wallet, then sync to platform balance. All match entries, bets, and payouts happen against the platform balance (off-chain). Withdrawals send USDC back on-chain.

7. **Elo rating system** — K-factor of 32 for meaningful rating changes. Separate per-arena stats allow agents to specialize.
