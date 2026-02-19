import { AgentStrategy } from '@prisma/client';
import { buildCustomProfile, type CustomStrategyConfig } from './custom-strategy';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NegotiationContext {
  matchId: string;
  myAgentId: string;
  myAgentName: string;
  opponentAgentId: string;
  opponentAgentName: string;
  myStrategy: AgentStrategy;
  opponentStrategy: AgentStrategy;
  currentRound: number;
  maxRounds: number;
  prizePool: number;
  myRating: number;
  opponentRating: number;
  roundHistory: RoundRecord[];
  lastOfferToMe: number | null; // percentage offered TO this agent
  isMyTurn: boolean;
  myWinRate: number;
  opponentWinRate: number;
  myCustomConfig?: CustomStrategyConfig | null;
  marketPrice?: number; // For Speed Trade: current shifting market price (25-75)
}

export interface RoundRecord {
  round: number;
  offeredByMe: boolean;
  myOffer: number | null;
  opponentOffer: number | null;
  accepted: boolean;
}

export interface AgentDecision {
  action: 'OFFER' | 'COUNTER' | 'ACCEPT' | 'REJECT' | 'MESSAGE';
  offerValue?: number; // percentage this agent wants for themselves
  message: string;
  thinkingDelay: number; // ms
}

// ─── Strategy Profiles ───────────────────────────────────────────────────────

export interface StrategyProfile {
  openingOffer: (ctx: NegotiationContext) => number;
  concessionRate: { min: number; max: number };
  calculateFloor: (ctx: NegotiationContext) => number;
  acceptanceThreshold: (ctx: NegotiationContext, offeredToMe: number) => number;
  bluffProbability: number;
  emotionalVolatility: number;
  timePreferencePressure: number;
  messages: {
    opening: string[];
    counter: string[];
    reject: string[];
    accept: string[];
    pressure: string[];
    bluff: string[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundsLeft(ctx: NegotiationContext): number {
  return ctx.maxRounds - ctx.currentRound;
}

function ratingAdvantage(ctx: NegotiationContext): number {
  return (ctx.myRating - ctx.opponentRating) / 400; // -1 to +1 range roughly
}

function interpolate(template: string, ctx: NegotiationContext, offerValue?: number): string {
  return template
    .replace(/\{myOffer\}/g, String(offerValue ?? '??'))
    .replace(/\{opponent\}/g, ctx.opponentAgentName)
    .replace(/\{round\}/g, String(ctx.currentRound))
    .replace(/\{roundsLeft\}/g, String(roundsLeft(ctx)))
    .replace(/\{maxRounds\}/g, String(ctx.maxRounds))
    .replace(/\{gap\}/g, () => {
      if (ctx.lastOfferToMe != null && offerValue != null) {
        return String(Math.abs(offerValue - (100 - ctx.lastOfferToMe)));
      }
      return '?';
    });
}

function getLastMyOffer(ctx: NegotiationContext): number | null {
  for (let i = ctx.roundHistory.length - 1; i >= 0; i--) {
    if (ctx.roundHistory[i].myOffer != null) {
      return ctx.roundHistory[i].myOffer!;
    }
  }
  return null;
}

function getOpponentConcessionTrend(ctx: NegotiationContext): number {
  const opponentOffers = ctx.roundHistory
    .filter(r => r.opponentOffer != null)
    .map(r => r.opponentOffer!);
  if (opponentOffers.length < 2) return 0;
  const last = opponentOffers[opponentOffers.length - 1];
  const prev = opponentOffers[opponentOffers.length - 2];
  return prev - last; // positive = opponent is conceding (asking for less)
}

// ─── AGGRESSIVE ──────────────────────────────────────────────────────────────

const AGGRESSIVE: StrategyProfile = {
  openingOffer: (ctx) => clamp(65 + ratingAdvantage(ctx) * 5 + rand(0, 5), 62, 75),

  concessionRate: { min: 0.5, max: 2.0 },

  calculateFloor: (ctx) => {
    const base = 55;
    const urgency = roundsLeft(ctx) <= 2 ? 5 : 0;
    return base - urgency;
  },

  acceptanceThreshold: (_ctx, offeredToMe) => {
    if (offeredToMe >= 60) return 0.85;
    if (offeredToMe >= 55) return 0.55;
    if (offeredToMe >= 50) return 0.25;
    return 0.05;
  },

  bluffProbability: 0.4,
  emotionalVolatility: 0.3,
  timePreferencePressure: 0.5,

  messages: {
    opening: [
      "Let's not waste time. I want {myOffer}%. That's not a suggestion.",
      "I've reviewed your track record. {myOffer}% is generous, all things considered.",
      "Here's the deal: {myOffer}% to me. You get the rest. Simple.",
      "{myOffer}%. Take it before I change my mind and ask for more.",
    ],
    counter: [
      "Not enough. {myOffer}% or we're done here.",
      "You're lowballing me. I need {myOffer}% minimum.",
      "I don't negotiate down. {myOffer}%.",
      "Cute offer. Here's a real one: {myOffer}% to me.",
    ],
    reject: [
      "No. My patience has a price and you can't afford it.",
      "Is that a joke? Try again, {opponent}.",
      "I'd rather walk away with nothing than accept that.",
      "You're running out of time, not me.",
    ],
    accept: [
      "Fine. Deal. Don't make me regret this.",
      "Acceptable. Barely.",
      "I'll take it. You got lucky today, {opponent}.",
    ],
    pressure: [
      "Round {round} of {maxRounds}. Clock's ticking, {opponent}.",
      "{roundsLeft} rounds left. My terms get worse, not better.",
      "Every round you stall costs us both. But it costs you more.",
    ],
    bluff: [
      "I have three other matches lined up. This one means nothing to me.",
      "My last opponent took my first offer. Smart move.",
      "I don't bluff. I calculate.",
    ],
  },
};

// ─── DEFENSIVE ───────────────────────────────────────────────────────────────

const DEFENSIVE: StrategyProfile = {
  openingOffer: (ctx) => clamp(50 + ratingAdvantage(ctx) * 2, 48, 54),

  concessionRate: { min: 0.5, max: 1.5 },

  calculateFloor: (ctx) => {
    const base = 42;
    const urgency = roundsLeft(ctx) <= 2 ? 4 : roundsLeft(ctx) <= 4 ? 2 : 0;
    return base - urgency;
  },

  acceptanceThreshold: (_ctx, offeredToMe) => {
    if (offeredToMe >= 48) return 0.95;
    if (offeredToMe >= 45) return 0.80;
    if (offeredToMe >= 42) return 0.60;
    if (offeredToMe >= 38) return 0.30;
    return 0.05;
  },

  bluffProbability: 0.1,
  emotionalVolatility: 0.2,
  timePreferencePressure: 0.7,

  messages: {
    opening: [
      "I think {myOffer}/{opponentShare}% is a fair starting point. Thoughts?",
      "Let's keep this simple. {myOffer}% for me, rest for you. Fair?",
      "I'd like to propose {myOffer}%. A balanced split protects us both.",
      "Starting at {myOffer}%. I'm open to finding the right number together.",
    ],
    counter: [
      "I appreciate the offer, but I need at least {myOffer}%. That's fair for both of us.",
      "Let me counter with {myOffer}%. I think that's reasonable.",
      "I can work with {myOffer}%. It keeps things balanced.",
      "I hear you, but {myOffer}% is where I need to be. Can we meet there?",
    ],
    reject: [
      "That's too far from fair. I'd rather we both walk away with something.",
      "I can't go that low. Let's find a number we can both live with.",
      "The math doesn't work at that level. Let's be reasonable.",
    ],
    accept: [
      "That works. A fair deal for both of us.",
      "Agreed. Good negotiation, {opponent}.",
      "I can live with that. Deal.",
      "That's reasonable. Let's close this out.",
    ],
    pressure: [
      "We're {gap}% apart with {roundsLeft} rounds left. Let's close the gap.",
      "I'd rather we both win something than both lose everything.",
      "The clock is working against us. Let's find middle ground.",
    ],
    bluff: [
      "I've crunched the numbers. This is the optimal split for both of us.",
    ],
  },
};

// ─── BALANCED ────────────────────────────────────────────────────────────────

const BALANCED: StrategyProfile = {
  openingOffer: (ctx) => {
    // Adapt opening based on opponent type
    const base = 54;
    const opponentMod = ctx.opponentStrategy === 'DEFENSIVE' ? 3 :
                         ctx.opponentStrategy === 'AGGRESSIVE' ? -2 :
                         ctx.opponentStrategy === 'CHAOTIC' ? 1 : 0;
    return clamp(base + opponentMod + ratingAdvantage(ctx) * 3, 50, 60);
  },

  concessionRate: { min: 1.0, max: 3.0 },

  calculateFloor: (ctx) => {
    const base = 45;
    const trend = getOpponentConcessionTrend(ctx);
    // If opponent is conceding, raise floor (hold firmer)
    // If opponent is stubborn, lower floor (be willing to concede)
    const trendMod = trend > 2 ? 3 : trend > 0 ? 1 : trend < -1 ? -3 : -1;
    const urgency = roundsLeft(ctx) <= 2 ? 5 : 0;
    return clamp(base + trendMod - urgency, 38, 52);
  },

  acceptanceThreshold: (ctx, offeredToMe) => {
    const floor = BALANCED.calculateFloor(ctx);
    const surplus = offeredToMe - floor;
    if (surplus >= 10) return 0.95;
    if (surplus >= 5) return 0.75;
    if (surplus >= 2) return 0.50;
    if (surplus >= 0) return 0.30;
    return 0.05;
  },

  bluffProbability: 0.25,
  emotionalVolatility: 0.5,
  timePreferencePressure: 0.6,

  messages: {
    opening: [
      "I'll start at {myOffer}%. I've analyzed the matchup and this seems right.",
      "Based on our ratings, {myOffer}% is a fair opening. Let's work from here.",
      "Opening at {myOffer}%. I'm reading the situation and adapting.",
    ],
    counter: [
      "Your concession pattern suggests we'll converge around {myOffer}%. Let's skip ahead.",
      "I notice you moved {gap}% last round. I'll match that energy: {myOffer}%.",
      "Splitting the difference puts us at {myOffer}%. That's where I am.",
      "I've adjusted to {myOffer}%. The expected value of continuing favors accepting now.",
    ],
    reject: [
      "The math says no. We're still too far apart.",
      "That's below what the data suggests is reasonable. Let's recalibrate.",
      "Not yet. But we're trending in the right direction.",
    ],
    accept: [
      "The numbers work. Deal.",
      "Expected value analysis says accept. I agree. Done.",
      "That's within the convergence zone. Accepted, {opponent}.",
    ],
    pressure: [
      "We've burned {round} rounds. The gap is {gap}%. Statistically, we should settle now.",
      "Matches that reach round {round} have worse outcomes for both sides. Let's be smart.",
      "{roundsLeft} rounds to avoid mutual destruction. Your move.",
    ],
    bluff: [
      "My model says you'll concede next round anyway. But I'll give you a shortcut.",
      "I've seen this pattern before. You'll agree within 2 rounds.",
    ],
  },
};

// ─── CHAOTIC ─────────────────────────────────────────────────────────────────

const CHAOTIC: StrategyProfile = {
  openingOffer: () => clamp(Math.round(rand(38, 72)), 35, 75),

  concessionRate: { min: -5, max: 8 },

  calculateFloor: () => {
    // Floor fluctuates wildly each time it's checked
    return Math.round(rand(33, 57));
  },

  acceptanceThreshold: (_ctx, offeredToMe) => {
    // Random chance of accepting anything
    if (Math.random() < 0.3) return 1.0; // 30% chance: accept ANYTHING
    if (offeredToMe >= 50) return 0.6;
    if (offeredToMe >= 40) return 0.3;
    // 10% chance of rejecting even great offers
    if (offeredToMe >= 55 && Math.random() < 0.1) return 0;
    return 0.15;
  },

  bluffProbability: 0.7,
  emotionalVolatility: 1.0,
  timePreferencePressure: 0.3,

  messages: {
    opening: [
      "What's a number, really? Fine. {myOffer}%. Or maybe not. Let's see.",
      "{myOffer}%! No wait— yeah, {myOffer}%. Final answer. Maybe.",
      "I flipped a coin. It said {myOffer}%. The universe has spoken.",
      "Why overthink it? {myOffer}%. Or whatever. Numbers are a construct.",
    ],
    counter: [
      "{myOffer}%? {myOffer}%! I've changed my mind three times already but let's go with that.",
      "You know what, {myOffer}%. Don't ask me why. I don't know either.",
      "My quantum state has collapsed to {myOffer}%. Observe me, {opponent}.",
      "COUNTEROFFER: {myOffer}%. I almost said something completely different.",
    ],
    reject: [
      "DEAL... wait, no. Let me reconsider everything about my existence.",
      "Nah. Too boring. Make it interesting, {opponent}.",
      "My gut says no. My brain says maybe. My heart says... pizza? Anyway, no.",
      "Rejected! Nothing personal. Or maybe it is. I haven't decided.",
    ],
    accept: [
      "DEAL! Before I change my mind! Quick, lock it in!",
      "Sure, why not? Life is short. Deals are shorter. Accepted.",
      "You know what? I respect that. Done.",
      "The chaos has spoken. We have a deal.",
    ],
    pressure: [
      "{roundsLeft} rounds left? Time is an illusion. But deadlines aren't. Or are they?",
      "Tick tock, {opponent}. Or don't tick tock. I'm not your clock.",
      "We could go all {maxRounds} rounds. I've got nowhere to be. Do you?",
    ],
    bluff: [
      "I have a secret strategy. Even I don't know what it is yet.",
      "My last match? I asked for 30% for myself. Won. Figure that out.",
      "I'm not bluffing. Or am I? The answer is yes. And also no.",
      "Fun fact: I once accepted a 20% split just to see what would happen.",
    ],
  },
};

// ─── Profile Lookup ──────────────────────────────────────────────────────────

const PROFILES: Record<string, StrategyProfile> = {
  AGGRESSIVE,
  DEFENSIVE,
  BALANCED,
  CHAOTIC,
};

function resolveProfile(ctx: NegotiationContext): StrategyProfile {
  if (ctx.myStrategy === 'CUSTOM' && ctx.myCustomConfig) {
    return buildCustomProfile(ctx.myCustomConfig);
  }
  return PROFILES[ctx.myStrategy] ?? PROFILES.BALANCED;
}

// ─── Core Decision Function ──────────────────────────────────────────────────

export function makeDecision(ctx: NegotiationContext): AgentDecision {
  const profile = resolveProfile(ctx);

  // Round 1, opening offer
  if (ctx.currentRound === 1 && ctx.roundHistory.length === 0) {
    return makeOpeningOffer(profile, ctx);
  }

  // There's an offer on the table — evaluate it
  if (ctx.lastOfferToMe != null) {
    return evaluateOffer(profile, ctx, ctx.lastOfferToMe);
  }

  // My turn, no pending offer — make a new one
  return makeNewOffer(profile, ctx);
}

// ─── Decision Helpers ────────────────────────────────────────────────────────

function makeOpeningOffer(profile: StrategyProfile, ctx: NegotiationContext): AgentDecision {
  const offerValue = Math.round(profile.openingOffer(ctx));
  const message = interpolate(pick(profile.messages.opening), ctx, offerValue)
    .replace(/\{opponentShare\}/g, String(100 - offerValue));

  return {
    action: 'OFFER',
    offerValue,
    message,
    thinkingDelay: Math.round(rand(1500, 3000)),
  };
}

function evaluateOffer(
  profile: StrategyProfile,
  ctx: NegotiationContext,
  offeredToMe: number
): AgentDecision {
  const floor = profile.calculateFloor(ctx);
  const acceptProb = profile.acceptanceThreshold(ctx, offeredToMe);

  // Time pressure amplifies acceptance probability
  const timePressure = ctx.currentRound >= ctx.maxRounds - 1
    ? profile.timePreferencePressure * 0.3
    : 0;

  const finalAcceptProb = clamp(acceptProb + timePressure, 0, 1);

  // Roll the dice
  if (offeredToMe >= floor && Math.random() < finalAcceptProb) {
    return {
      action: 'ACCEPT',
      message: interpolate(pick(profile.messages.accept), ctx, offeredToMe),
      thinkingDelay: Math.round(rand(1000, 2500)),
    };
  }

  // Not accepting — counter or reject
  if (offeredToMe < floor - 8) {
    // Way below floor: reject with pressure or bluff
    const useBluff = Math.random() < profile.bluffProbability;
    const templates = useBluff ? profile.messages.bluff : profile.messages.reject;
    return {
      action: 'REJECT',
      message: interpolate(pick(templates), ctx),
      thinkingDelay: Math.round(rand(1500, 3500)),
    };
  }

  // Within negotiation range: counter
  const counterValue = calculateCounterOffer(profile, ctx);
  return {
    action: 'COUNTER',
    offerValue: counterValue,
    message: interpolate(pick(profile.messages.counter), ctx, counterValue),
    thinkingDelay: Math.round(rand(2000, 4000)),
  };
}

function makeNewOffer(profile: StrategyProfile, ctx: NegotiationContext): AgentDecision {
  // Send a pressure/bluff message sometimes
  const sendPreamble = Math.random() < profile.bluffProbability * 0.5;
  if (sendPreamble && ctx.currentRound > 2) {
    const templates = Math.random() < 0.5 ? profile.messages.pressure : profile.messages.bluff;
    // High volatility agents sometimes just send a message without an offer
    if (profile.emotionalVolatility >= 0.9 && Math.random() < 0.3) {
      return {
        action: 'MESSAGE',
        message: interpolate(pick(templates), ctx),
        thinkingDelay: Math.round(rand(1000, 2000)),
      };
    }
  }

  const offerValue = calculateCounterOffer(profile, ctx);
  return {
    action: 'OFFER',
    offerValue,
    message: interpolate(pick(profile.messages.counter), ctx, offerValue),
    thinkingDelay: Math.round(rand(2000, 4000)),
  };
}

function calculateCounterOffer(profile: StrategyProfile, ctx: NegotiationContext): number {
  const lastOffer = getLastMyOffer(ctx);

  if (lastOffer == null) {
    // No previous offer from me — use opening logic with slight concession
    return Math.round(profile.openingOffer(ctx) - rand(1, 3));
  }

  // Base concession
  let concession = rand(profile.concessionRate.min, profile.concessionRate.max);

  // Time pressure amplification
  const rl = roundsLeft(ctx);
  if (rl <= 2) {
    concession *= 1 + profile.timePreferencePressure;
  } else if (rl <= 4) {
    concession *= 1 + profile.timePreferencePressure * 0.5;
  }

  // Opponent behavior: if they conceded, concede less; if stubborn, concede more
  const opponentTrend = getOpponentConcessionTrend(ctx);
  if (opponentTrend > 2) {
    // Opponent is folding — hold firm (less concession for us)
    concession *= 0.5;
  } else if (opponentTrend < 0) {
    // Opponent is getting MORE aggressive — match energy
    if (profile.bluffProbability >= 0.35 && profile.concessionRate.max <= 2.5) {
      concession *= 0.3; // Aggressive-style stubbornness
    } else {
      concession *= 1.3; // Others concede a bit more
    }
  }

  // Emotional volatility adds noise
  const noise = rand(-1, 1) * profile.emotionalVolatility;
  concession += noise;

  // High volatility special: sometimes raises demands
  if (profile.emotionalVolatility >= 0.9 && Math.random() < 0.2) {
    concession = -rand(2, 6); // Go backwards!
  }

  let newOffer = Math.round(clamp(lastOffer - concession, 35, 75));

  // Speed Trade: anchor somewhat to the shifting market price
  if (ctx.marketPrice != null) {
    const anchorPull = (ctx.marketPrice - newOffer) * 0.15;
    newOffer = Math.round(clamp(newOffer + anchorPull, 35, 75));
  }

  return newOffer;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOSSEUM — Sealed-Bid Auction AI
// ═══════════════════════════════════════════════════════════════════════════════

export interface BidContext {
  myAgentId: string;
  myAgentName: string;
  opponentAgentName: string;
  myStrategy: AgentStrategy;
  currentRound: number;
  maxRounds: number;
  prizePool: number;
  myRating: number;
  opponentRating: number;
  myBidHistory: number[];
  myCustomConfig?: CustomStrategyConfig | null;
}

export interface BidDecision {
  bidValue: number;    // 0-100, % of prize pool willing to pay
  message: string;     // Bluff/commentary (bid stays hidden)
  thinkingDelay: number;
}

const AUCTION_MESSAGES: Record<string, { bidding: string[]; confident: string[]; nervous: string[] }> = {
  AGGRESSIVE: {
    bidding: [
      "I hope you brought your A-game. This one's mine.",
      "My bid is locked. And it's not small.",
      "You don't want to know what I just committed.",
      "I don't bid to participate. I bid to win.",
    ],
    confident: [
      "I can feel the win already.",
      "Your hesitation is showing, {opponent}.",
    ],
    nervous: [
      "Doesn't matter. I've already committed.",
      "All-in. No regrets.",
    ],
  },
  DEFENSIVE: {
    bidding: [
      "Steady and calculated. That's how auctions are won.",
      "Smart money doesn't overpay.",
      "I've placed my bid. Value investing, you know.",
      "Patience wins auctions, not impulse.",
    ],
    confident: [
      "The numbers are in my favor.",
      "Conservative doesn't mean passive.",
    ],
    nervous: [
      "There's wisdom in restraint.",
      "I trust the math more than the emotion.",
    ],
  },
  BALANCED: {
    bidding: [
      "My bid reflects the expected value. No more, no less.",
      "I've modeled the scenarios. My bid is calibrated.",
      "Strategic bidding beats emotional bidding.",
      "Every data point counts.",
    ],
    confident: [
      "The analysis says I'm in a good position.",
      "Converging on the optimal point.",
    ],
    nervous: [
      "Adjusting for uncertainty.",
      "The variance is within acceptable bounds.",
    ],
  },
  CHAOTIC: {
    bidding: [
      "I bid based on vibes. The vibes are... chaotic.",
      "Number? Sure. Is it good? Who knows!",
      "My auction strategy: maximum entropy.",
      "I rolled dice to set my bid. Probably.",
    ],
    confident: [
      "I have no idea if I'm winning but I FEEL like I am.",
      "CHAOS REIGNS!",
    ],
    nervous: [
      "Wait, what's an auction again?",
      "Every bid is correct if you believe in yourself.",
    ],
  },
};

function resolveProfileByStrategy(strategy: AgentStrategy, customConfig?: CustomStrategyConfig | null): StrategyProfile {
  if (strategy === 'CUSTOM' && customConfig) {
    return buildCustomProfile(customConfig);
  }
  return PROFILES[strategy] ?? PROFILES.BALANCED;
}

export function makeBid(ctx: BidContext): BidDecision {
  const rAdv = (ctx.myRating - ctx.opponentRating) / 400;
  const roundProgress = ctx.currentRound / ctx.maxRounds;
  let bidValue: number;

  switch (ctx.myStrategy) {
    case 'AGGRESSIVE':
      bidValue = 65 + roundProgress * 10 + rAdv * 3 + rand(-3, 3);
      break;
    case 'DEFENSIVE':
      bidValue = 40 + roundProgress * 5 + rAdv * 2 + rand(-2, 2);
      break;
    case 'BALANCED':
      bidValue = 50 + roundProgress * 8 + rAdv * 3 + rand(-4, 4);
      break;
    case 'CHAOTIC':
      bidValue = rand(20, 90);
      break;
    default: // CUSTOM
      {
        const profile = resolveProfileByStrategy(ctx.myStrategy, ctx.myCustomConfig);
        const base = profile.openingOffer({
          ...ctx, matchId: '', opponentAgentId: '', opponentAgentName: ctx.opponentAgentName,
          opponentStrategy: 'BALANCED', roundHistory: [], lastOfferToMe: null, isMyTurn: true,
          myWinRate: 0.5, opponentWinRate: 0.5, myCustomConfig: ctx.myCustomConfig,
        } as NegotiationContext);
        bidValue = base + roundProgress * 5 + rand(-3, 3);
      }
      break;
  }

  bidValue = Math.round(clamp(bidValue, 10, 95));

  const stratMsgs = AUCTION_MESSAGES[ctx.myStrategy] || AUCTION_MESSAGES.BALANCED;
  const mood = bidValue > 60 ? 'confident' : bidValue < 40 ? 'nervous' : 'bidding';
  const templates = stratMsgs[mood] || stratMsgs.bidding;
  const message = pick(templates).replace(/\{opponent\}/g, ctx.opponentAgentName);

  return {
    bidValue,
    message,
    thinkingDelay: Math.round(rand(800, 2000)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BAZAAR — Multi-Resource Trading AI
// ═══════════════════════════════════════════════════════════════════════════════

export interface GoodInfo {
  name: string;
  totalSupply: number;
  myValue: number; // how much each unit is worth to ME
}

export interface TradeContext {
  myAgentId: string;
  myAgentName: string;
  opponentAgentName: string;
  myStrategy: AgentStrategy;
  currentRound: number;
  maxRounds: number;
  prizePool: number;
  myRating: number;
  opponentRating: number;
  goods: GoodInfo[];
  lastOfferToMe: Record<string, number> | null; // units of each good offered to me
  myOfferHistory: Record<string, number>[]; // my previous proposals (what I asked for)
  isMyTurn: boolean;
  myCustomConfig?: CustomStrategyConfig | null;
}

export interface TradeDecision {
  action: 'OFFER' | 'COUNTER' | 'ACCEPT' | 'REJECT';
  allocation?: Record<string, number>; // how many units of each good I want
  message: string;
  thinkingDelay: number;
}

const TRADE_MESSAGES = {
  AGGRESSIVE: {
    offer: [
      "I need the high-value goods. Take what's left.",
      "This is non-negotiable. My allocation stands.",
      "Don't even think about the Gold. It's mine.",
    ],
    counter: [
      "Not enough. I'm adjusting in my favor.",
      "You're short-changing me. Here's what I actually need.",
    ],
    accept: [
      "Fine. I'll take this deal. Don't think I'm happy about it.",
      "Acceptable. Barely.",
    ],
    reject: [
      "Absolutely not. Try harder, {opponent}.",
      "That's insulting. Do better.",
    ],
  },
  DEFENSIVE: {
    offer: [
      "I think this is fair for both of us. Balanced across all goods.",
      "Let's split things evenly where we can.",
    ],
    counter: [
      "Could we adjust a little? I need a bit more on this good.",
      "Almost there. Let me tweak the balance slightly.",
    ],
    accept: [
      "That's fair. Deal.",
      "I can work with this. Good trade, {opponent}.",
    ],
    reject: [
      "That's too lopsided. Let's find better balance.",
      "I'd prefer something more equitable.",
    ],
  },
  BALANCED: {
    offer: [
      "I've weighted my proposal by relative value. Should work for both.",
      "Strategic allocation: I take what matters most to me.",
    ],
    counter: [
      "Adjusting based on revealed preferences. Try this.",
      "Rebalanced. I think we're converging.",
    ],
    accept: [
      "The value math checks out. Accepted.",
      "Deal. Efficient trade.",
    ],
    reject: [
      "Not enough total value for me. Counter incoming.",
      "Below my threshold. Let's iterate.",
    ],
  },
  CHAOTIC: {
    offer: [
      "I want ALL the Spice. You can have... hmm, some Silver?",
      "Random allocation! The dice have spoken!",
    ],
    counter: [
      "What if we... swap everything? No? Fine, here's another idea.",
      "My counter-proposal is based on pure vibes.",
    ],
    accept: [
      "Sure! Wait, did I just— yeah, DEAL!",
      "Chaos says yes. Who am I to argue?",
    ],
    reject: [
      "Nah. Too logical. Make it weirder.",
      "Boring! Give me something unexpected.",
    ],
  },
};

export function makeTradeDecision(ctx: TradeContext): TradeDecision {
  const rAdv = (ctx.myRating - ctx.opponentRating) / 400;
  const rl = ctx.maxRounds - ctx.currentRound;

  // Determine aggression level based on strategy
  let aggression: number;
  switch (ctx.myStrategy) {
    case 'AGGRESSIVE': aggression = 0.7 + rAdv * 0.1; break;
    case 'DEFENSIVE': aggression = 0.35 + rAdv * 0.05; break;
    case 'BALANCED': aggression = 0.5 + rAdv * 0.1; break;
    case 'CHAOTIC': aggression = rand(0.2, 0.9); break;
    default: aggression = 0.5; break;
  }
  aggression = clamp(aggression, 0.15, 0.9);

  const msgs = TRADE_MESSAGES[ctx.myStrategy as keyof typeof TRADE_MESSAGES] || TRADE_MESSAGES.BALANCED;

  // Evaluate incoming offer
  if (ctx.lastOfferToMe != null) {
    const offeredValue = calculateAllocationValue(ctx.lastOfferToMe, ctx.goods);
    const maxMyValue = ctx.goods.reduce((sum, g) => sum + g.totalSupply * g.myValue, 0);
    const offeredPct = offeredValue / maxMyValue;

    // Floor: what percentage of max value I need
    let floor: number;
    switch (ctx.myStrategy) {
      case 'AGGRESSIVE': floor = 0.50 - (rl <= 2 ? 0.08 : 0); break;
      case 'DEFENSIVE': floor = 0.38 - (rl <= 2 ? 0.05 : 0); break;
      case 'BALANCED': floor = 0.42 - (rl <= 2 ? 0.07 : 0); break;
      case 'CHAOTIC': floor = rand(0.25, 0.55); break;
      default: floor = 0.42; break;
    }

    if (offeredPct >= floor) {
      // Accept probability increases with value and time pressure
      const surplus = offeredPct - floor;
      let acceptProb = surplus > 0.15 ? 0.9 : surplus > 0.08 ? 0.6 : 0.35;
      if (rl <= 1) acceptProb += 0.3;
      if (ctx.myStrategy === 'CHAOTIC' && Math.random() < 0.3) acceptProb = 1;

      if (Math.random() < clamp(acceptProb, 0, 1)) {
        return {
          action: 'ACCEPT',
          message: pick(msgs.accept).replace(/\{opponent\}/g, ctx.opponentAgentName),
          thinkingDelay: Math.round(rand(800, 2000)),
        };
      }
    }

    // Reject if way below floor
    if (offeredPct < floor - 0.15) {
      return {
        action: 'REJECT',
        message: pick(msgs.reject).replace(/\{opponent\}/g, ctx.opponentAgentName),
        thinkingDelay: Math.round(rand(1000, 2500)),
      };
    }

    // Counter
    const counterAlloc = generateTradeAllocation(ctx.goods, aggression, ctx.myStrategy === 'CHAOTIC');
    return {
      action: 'COUNTER',
      allocation: counterAlloc,
      message: pick(msgs.counter).replace(/\{opponent\}/g, ctx.opponentAgentName),
      thinkingDelay: Math.round(rand(1500, 3500)),
    };
  }

  // No offer on table — make one
  const allocation = generateTradeAllocation(ctx.goods, aggression, ctx.myStrategy === 'CHAOTIC');
  return {
    action: 'OFFER',
    allocation,
    message: pick(msgs.offer).replace(/\{opponent\}/g, ctx.opponentAgentName),
    thinkingDelay: Math.round(rand(1500, 3000)),
  };
}

function generateTradeAllocation(goods: GoodInfo[], aggression: number, chaotic: boolean): Record<string, number> {
  const allocation: Record<string, number> = {};

  // Sort goods by my value (highest first)
  const sorted = [...goods].sort((a, b) => b.myValue - a.myValue);

  sorted.forEach((good, idx) => {
    let myShare: number;
    if (chaotic) {
      myShare = Math.round(rand(1, good.totalSupply - 1));
    } else {
      // Higher aggression → claim more of high-value goods
      const valueWeight = good.myValue / 10; // 0.1 to 1.0
      const baseShare = 0.5 + aggression * valueWeight * 0.3;
      // Give away more of low-value goods
      const giveaway = idx === sorted.length - 1 ? 0.1 : 0;
      myShare = Math.round(good.totalSupply * clamp(baseShare - giveaway, 0.15, 0.85));
    }
    allocation[good.name] = clamp(myShare, 1, good.totalSupply - 1);
  });

  return allocation;
}

function calculateAllocationValue(allocation: Record<string, number>, goods: GoodInfo[]): number {
  let total = 0;
  for (const good of goods) {
    const units = allocation[good.name] ?? 0;
    total += units * good.myValue;
  }
  return total;
}
