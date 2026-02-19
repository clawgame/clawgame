import { NextRequest, NextResponse } from 'next/server';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface EnforceRateLimitOptions {
  namespace: string;
  limit: number;
  windowMs: number;
  identifier?: string;
  message?: string;
}

const globalForRateLimit = globalThis as unknown as {
  clawgameRateLimitStore?: Map<string, RateLimitBucket>;
};

function getRateLimitStore(): Map<string, RateLimitBucket> {
  if (!globalForRateLimit.clawgameRateLimitStore) {
    globalForRateLimit.clawgameRateLimitStore = new Map<string, RateLimitBucket>();
  }

  return globalForRateLimit.clawgameRateLimitStore;
}

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(',');
    const normalized = firstIp.trim();
    if (normalized.length > 0) return normalized;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  return 'unknown-client';
}

function pruneExpiredBuckets(store: Map<string, RateLimitBucket>, now: number): void {
  if (store.size < 500) return;

  store.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  });
}

export function enforceRateLimit(
  request: NextRequest,
  options: EnforceRateLimitOptions
): NextResponse | null {
  const now = Date.now();
  const store = getRateLimitStore();
  pruneExpiredBuckets(store, now);

  const identifier = options.identifier || getClientIdentifier(request);
  const key = `${options.namespace}:${identifier}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return null;
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      {
        error: options.message || 'Too many requests. Please slow down and try again shortly.',
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  existing.count += 1;
  store.set(key, existing);
  return null;
}
