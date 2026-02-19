import type { WSEvent, WSEventType } from '@/types';

type EventCallback = (event: WSEvent) => void;

// In-memory event bus — survives across API route invocations in dev (global singleton)
const globalForEmitter = globalThis as unknown as {
  matchEventBus: Map<string, Set<EventCallback>> | undefined;
};

const matchEventBus: Map<string, Set<EventCallback>> =
  globalForEmitter.matchEventBus ?? new Map();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitter.matchEventBus = matchEventBus;
}

/**
 * Subscribe to events for a specific match (or '__global__' for all matches).
 * Returns an unsubscribe function.
 */
export function subscribeToMatch(matchId: string, callback: EventCallback): () => void {
  if (!matchEventBus.has(matchId)) {
    matchEventBus.set(matchId, new Set());
  }
  matchEventBus.get(matchId)!.add(callback);

  return () => {
    matchEventBus.get(matchId)?.delete(callback);
    if (matchEventBus.get(matchId)?.size === 0) {
      matchEventBus.delete(matchId);
    }
  };
}

/**
 * Emit an event to all subscribers of a match + global subscribers.
 */
export async function emitMatchEvent(
  matchId: string,
  type: WSEventType,
  data: unknown
): Promise<void> {
  const event: WSEvent = {
    type,
    matchId,
    data,
    timestamp: new Date().toISOString(),
  };

  // Push to match-specific subscribers
  const matchSubs = matchEventBus.get(matchId);
  if (matchSubs) {
    matchSubs.forEach((cb) => {
      try { cb(event); } catch { /* subscriber error */ }
    });
  }

  // Push to global subscribers (homepage live feed)
  const globalSubs = matchEventBus.get('__global__');
  if (globalSubs) {
    globalSubs.forEach((cb) => {
      try { cb(event); } catch { /* subscriber error */ }
    });
  }
}
