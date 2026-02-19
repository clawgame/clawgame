import type { StrategyProfile, NegotiationContext } from './agent-ai';

// ─── Custom Strategy Config (User-Facing JSON Schema) ──────────────────────

export interface CustomStrategyConfig {
  openingOffer?: {
    base?: number;            // 35-75, default 54
    ratingInfluence?: number; // 0-10, how much rating advantage shifts opening
    randomRange?: number;     // 0-10, +/- random noise
  };
  concession?: {
    min?: number; // -5 to 10, minimum concession per round
    max?: number; // -5 to 10, maximum concession per round
  };
  floor?: {
    base?: number;        // 30-60, minimum acceptable percentage
    urgencyDrop?: number; // 0-15, how much floor drops in final 2 rounds
  };
  acceptance?: {
    generous?: number; // 0-1, prob when offer is 10+ above floor
    good?: number;     // 0-1, prob when offer is 5-9 above floor
    fair?: number;     // 0-1, prob when offer is 2-4 above floor
    tight?: number;    // 0-1, prob when offer is 0-1 above floor
    below?: number;    // 0-1, prob when offer is below floor
  };
  bluffProbability?: number;        // 0-1
  emotionalVolatility?: number;     // 0-1
  timePreferencePressure?: number;  // 0-1
  messages?: {
    opening?: string[];
    counter?: string[];
    reject?: string[];
    accept?: string[];
    pressure?: string[];
    bluff?: string[];
  };
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULTS = {
  openingOffer: { base: 54, ratingInfluence: 3, randomRange: 2 },
  concession: { min: 1.0, max: 3.0 },
  floor: { base: 45, urgencyDrop: 5 },
  acceptance: { generous: 0.95, good: 0.75, fair: 0.50, tight: 0.30, below: 0.05 },
  bluffProbability: 0.25,
  emotionalVolatility: 0.5,
  timePreferencePressure: 0.6,
} as const;

// Fallback messages (BALANCED-style)
const DEFAULT_MESSAGES: StrategyProfile['messages'] = {
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
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function clampNum(value: unknown, min: number, max: number, defaultVal: number): number {
  if (value === undefined || value === null) return defaultVal;
  const num = Number(value);
  if (isNaN(num)) return defaultVal;
  return Math.min(max, Math.max(min, num));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateStrategyConfig(raw: unknown): CustomStrategyConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Strategy config must be a JSON object');
  }

  const input = raw as Record<string, unknown>;
  const config: CustomStrategyConfig = {};

  // openingOffer
  if (input.openingOffer && typeof input.openingOffer === 'object') {
    const oo = input.openingOffer as Record<string, unknown>;
    config.openingOffer = {
      base: clampNum(oo.base, 35, 75, DEFAULTS.openingOffer.base),
      ratingInfluence: clampNum(oo.ratingInfluence, 0, 10, DEFAULTS.openingOffer.ratingInfluence),
      randomRange: clampNum(oo.randomRange, 0, 10, DEFAULTS.openingOffer.randomRange),
    };
  }

  // concession
  if (input.concession && typeof input.concession === 'object') {
    const c = input.concession as Record<string, unknown>;
    let min = clampNum(c.min, -5, 10, DEFAULTS.concession.min);
    let max = clampNum(c.max, -5, 10, DEFAULTS.concession.max);
    if (min > max) [min, max] = [max, min];
    config.concession = { min, max };
  }

  // floor
  if (input.floor && typeof input.floor === 'object') {
    const f = input.floor as Record<string, unknown>;
    config.floor = {
      base: clampNum(f.base, 30, 60, DEFAULTS.floor.base),
      urgencyDrop: clampNum(f.urgencyDrop, 0, 15, DEFAULTS.floor.urgencyDrop),
    };
  }

  // acceptance
  if (input.acceptance && typeof input.acceptance === 'object') {
    const a = input.acceptance as Record<string, unknown>;
    config.acceptance = {
      generous: clampNum(a.generous, 0, 1, DEFAULTS.acceptance.generous),
      good: clampNum(a.good, 0, 1, DEFAULTS.acceptance.good),
      fair: clampNum(a.fair, 0, 1, DEFAULTS.acceptance.fair),
      tight: clampNum(a.tight, 0, 1, DEFAULTS.acceptance.tight),
      below: clampNum(a.below, 0, 1, DEFAULTS.acceptance.below),
    };
  }

  // scalar traits
  if (input.bluffProbability !== undefined) {
    config.bluffProbability = clampNum(input.bluffProbability, 0, 1, DEFAULTS.bluffProbability);
  }
  if (input.emotionalVolatility !== undefined) {
    config.emotionalVolatility = clampNum(input.emotionalVolatility, 0, 1, DEFAULTS.emotionalVolatility);
  }
  if (input.timePreferencePressure !== undefined) {
    config.timePreferencePressure = clampNum(input.timePreferencePressure, 0, 1, DEFAULTS.timePreferencePressure);
  }

  // messages (max 10 per category, max 200 chars each)
  if (input.messages && typeof input.messages === 'object') {
    const m = input.messages as Record<string, unknown>;
    config.messages = {};
    const categories = ['opening', 'counter', 'reject', 'accept', 'pressure', 'bluff'] as const;
    for (const key of categories) {
      if (Array.isArray(m[key])) {
        config.messages[key] = (m[key] as unknown[])
          .filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length <= 200)
          .slice(0, 10);
      }
    }
  }

  return config;
}

// ─── Build Profile ──────────────────────────────────────────────────────────

export function buildCustomProfile(config: CustomStrategyConfig): StrategyProfile {
  const oo = { ...DEFAULTS.openingOffer, ...config.openingOffer };
  const con = { ...DEFAULTS.concession, ...config.concession };
  const fl = { ...DEFAULTS.floor, ...config.floor };
  const acc = { ...DEFAULTS.acceptance, ...config.acceptance };
  const bluff = config.bluffProbability ?? DEFAULTS.bluffProbability;
  const volatility = config.emotionalVolatility ?? DEFAULTS.emotionalVolatility;
  const timePressure = config.timePreferencePressure ?? DEFAULTS.timePreferencePressure;

  // Merge messages: user-provided categories override defaults, missing ones use defaults
  const msgs: StrategyProfile['messages'] = { ...DEFAULT_MESSAGES };
  if (config.messages) {
    const categories = ['opening', 'counter', 'reject', 'accept', 'pressure', 'bluff'] as const;
    for (const key of categories) {
      if (config.messages[key] && config.messages[key]!.length > 0) {
        msgs[key] = config.messages[key]!;
      }
    }
  }

  return {
    openingOffer: (ctx: NegotiationContext) => {
      const ratingAdv = (ctx.myRating - ctx.opponentRating) / 400;
      const noise = (Math.random() * 2 - 1) * oo.randomRange;
      return clamp(oo.base + ratingAdv * oo.ratingInfluence + noise, 35, 75);
    },

    concessionRate: { min: con.min, max: con.max },

    calculateFloor: (ctx: NegotiationContext) => {
      const roundsLeft = ctx.maxRounds - ctx.currentRound;
      const urgency = roundsLeft <= 2 ? fl.urgencyDrop : 0;
      return clamp(fl.base - urgency, 30, 60);
    },

    acceptanceThreshold: (_ctx: NegotiationContext, offeredToMe: number) => {
      const surplus = offeredToMe - fl.base;
      if (surplus >= 10) return acc.generous;
      if (surplus >= 5) return acc.good;
      if (surplus >= 2) return acc.fair;
      if (surplus >= 0) return acc.tight;
      return acc.below;
    },

    bluffProbability: bluff,
    emotionalVolatility: volatility,
    timePreferencePressure: timePressure,
    messages: msgs,
  };
}
