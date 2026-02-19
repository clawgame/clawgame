import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { emitMatchEvent, subscribeToMatch } from '@/lib/engine/ws-emitter';
import type { WSEvent, WSSpectatorsEvent } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MatchSpectatorStore = Map<string, Set<string>>;

const globalForSpectators = globalThis as unknown as {
  clawgameSpectatorStore?: MatchSpectatorStore;
};

function getSpectatorStore(): MatchSpectatorStore {
  if (!globalForSpectators.clawgameSpectatorStore) {
    globalForSpectators.clawgameSpectatorStore = new Map<string, Set<string>>();
  }

  return globalForSpectators.clawgameSpectatorStore;
}

function trackConnection(matchId: string, connectionId: string): number {
  const store = getSpectatorStore();
  const existing = store.get(matchId) || new Set<string>();
  existing.add(connectionId);
  store.set(matchId, existing);
  return existing.size;
}

function untrackConnection(matchId: string, connectionId: string): number {
  const store = getSpectatorStore();
  const existing = store.get(matchId);
  if (!existing) return 0;

  existing.delete(connectionId);
  if (existing.size === 0) {
    store.delete(matchId);
    return 0;
  }

  store.set(matchId, existing);
  return existing.size;
}

async function persistSpectatorCount(matchId: string, count: number): Promise<void> {
  try {
    await prisma.match.update({
      where: { id: matchId },
      data: { spectatorCount: count },
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== 'P2025') {
      console.error(`[SSE] Failed to persist spectator count for ${matchId}:`, error);
    }
  }

  const payload: WSSpectatorsEvent = { count };
  await emitMatchEvent(matchId, 'spectators', payload);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;
  const encoder = new TextEncoder();
  const connectionId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const stream = new ReadableStream({
    async start(controller) {
      const connectedCount = trackConnection(matchId, connectionId);
      await persistSpectatorCount(matchId, connectedCount);

      // Send initial keepalive
      controller.enqueue(encoder.encode(`:connected to match ${matchId}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'spectators',
        matchId,
        data: { count: connectedCount },
        timestamp: new Date().toISOString(),
      })}\n\n`));

      // Subscribe to match events
      const unsubscribe = subscribeToMatch(matchId, (event: WSEvent) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Controller might be closed
        }
      });

      // Keepalive every 15s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:keepalive\n\n`));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);

      // Cleanup on disconnect
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;

        unsubscribe();
        clearInterval(keepalive);
        const remaining = untrackConnection(matchId, connectionId);
        persistSpectatorCount(matchId, remaining).catch((error) => {
          console.error(`[SSE] Failed cleanup persist for ${matchId}:`, error);
        });
        try { controller.close(); } catch { /* already closed */ }
      };

      request.signal.addEventListener('abort', () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
