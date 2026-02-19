import type { ArenaType } from '@/types';

export interface MatchQueueEntry {
  id: string;
  agentId: string;
  arena: ArenaType;
  prizePool: number;
  maxRounds: number;
  rating: number;
  joinedAt: string;
}

export interface QueueArenaStats {
  arena: ArenaType;
  waiting: number;
  oldestJoinAt?: string;
}

type QueueMap = Record<ArenaType, MatchQueueEntry[]>;

interface QueueStore {
  queues: QueueMap;
}

const EMPTY_QUEUES: QueueMap = {
  'the-pit': [],
  colosseum: [],
  'speed-trade': [],
  bazaar: [],
};

const globalForQueue = globalThis as unknown as {
  clawgameQueueStore?: QueueStore;
};

function getQueueStore(): QueueStore {
  if (!globalForQueue.clawgameQueueStore) {
    globalForQueue.clawgameQueueStore = {
      queues: {
        'the-pit': [],
        colosseum: [],
        'speed-trade': [],
        bazaar: [],
      },
    };
  }

  return globalForQueue.clawgameQueueStore;
}

function makeQueueId(agentId: string, arena: ArenaType): string {
  return `q_${arena}_${agentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cloneEntry(entry: MatchQueueEntry): MatchQueueEntry {
  return { ...entry };
}

export function listQueueEntries(arena: ArenaType): MatchQueueEntry[] {
  const store = getQueueStore();
  return store.queues[arena].map(cloneEntry);
}

export function getQueueEntry(agentId: string, arena?: ArenaType): MatchQueueEntry | null {
  const store = getQueueStore();

  if (arena) {
    const entry = store.queues[arena].find((item) => item.agentId === agentId);
    return entry ? cloneEntry(entry) : null;
  }

  for (const key of Object.keys(store.queues) as ArenaType[]) {
    const entry = store.queues[key].find((item) => item.agentId === agentId);
    if (entry) return cloneEntry(entry);
  }

  return null;
}

export function enqueueQueueEntry(
  input: Omit<MatchQueueEntry, 'id' | 'joinedAt'>
): { entry: MatchQueueEntry; position: number; alreadyQueued: boolean } {
  const store = getQueueStore();
  const existing = store.queues[input.arena].find((item) => item.agentId === input.agentId);

  if (existing) {
    return {
      entry: cloneEntry(existing),
      position: store.queues[input.arena].findIndex((item) => item.id === existing.id) + 1,
      alreadyQueued: true,
    };
  }

  const entry: MatchQueueEntry = {
    id: makeQueueId(input.agentId, input.arena),
    agentId: input.agentId,
    arena: input.arena,
    prizePool: input.prizePool,
    maxRounds: input.maxRounds,
    rating: input.rating,
    joinedAt: new Date().toISOString(),
  };

  store.queues[input.arena].push(entry);

  return {
    entry: cloneEntry(entry),
    position: store.queues[input.arena].length,
    alreadyQueued: false,
  };
}

export function removeQueueEntryById(entryId: string): MatchQueueEntry | null {
  const store = getQueueStore();

  for (const key of Object.keys(store.queues) as ArenaType[]) {
    const index = store.queues[key].findIndex((item) => item.id === entryId);
    if (index !== -1) {
      const [removed] = store.queues[key].splice(index, 1);
      return removed ? cloneEntry(removed) : null;
    }
  }

  return null;
}

export function restoreQueueEntry(entry: MatchQueueEntry): void {
  const store = getQueueStore();
  const exists = store.queues[entry.arena].some((item) => item.id === entry.id);
  if (exists) return;
  store.queues[entry.arena].push(entry);
}

export function removeAgentFromQueue(agentId: string, arena?: ArenaType): number {
  const store = getQueueStore();
  let removed = 0;

  if (arena) {
    const before = store.queues[arena].length;
    store.queues[arena] = store.queues[arena].filter((item) => item.agentId !== agentId);
    return before - store.queues[arena].length;
  }

  for (const key of Object.keys(store.queues) as ArenaType[]) {
    const before = store.queues[key].length;
    store.queues[key] = store.queues[key].filter((item) => item.agentId !== agentId);
    removed += before - store.queues[key].length;
  }

  return removed;
}

export function getQueuePosition(entryId: string, arena: ArenaType): number {
  const store = getQueueStore();
  return store.queues[arena].findIndex((item) => item.id === entryId) + 1;
}

export function getQueueCandidates(params: {
  arena: ArenaType;
  prizePool: number;
  agentId: string;
  rating: number;
}): MatchQueueEntry[] {
  const store = getQueueStore();

  return store.queues[params.arena]
    .filter((item) => item.agentId !== params.agentId && item.prizePool === params.prizePool)
    .sort((a, b) => {
      const byRating = Math.abs(a.rating - params.rating) - Math.abs(b.rating - params.rating);
      if (byRating !== 0) return byRating;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    })
    .map(cloneEntry);
}

export function getQueueStats(arena?: ArenaType): QueueArenaStats[] {
  const store = getQueueStore();
  const arenas = arena ? [arena] : (Object.keys(EMPTY_QUEUES) as ArenaType[]);

  return arenas.map((key) => {
    const entries = store.queues[key];
    const oldest = entries.reduce<string | undefined>((oldestJoinedAt, item) => {
      if (!oldestJoinedAt) return item.joinedAt;
      return new Date(item.joinedAt) < new Date(oldestJoinedAt) ? item.joinedAt : oldestJoinedAt;
    }, undefined);

    return {
      arena: key,
      waiting: entries.length,
      oldestJoinAt: oldest,
    };
  });
}
