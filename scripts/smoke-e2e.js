#!/usr/bin/env node

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const raw = await response.text();
  let json = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    // Keep json as null when body is not JSON.
  }

  return { response, json, raw };
}

async function expectStatus(path, status = 200) {
  const { response, json, raw } = await fetchJson(path);

  if (response.status !== status) {
    const snippet = json ? JSON.stringify(json).slice(0, 220) : raw.slice(0, 220);
    throw new Error(`${path} expected ${status} got ${response.status}: ${snippet}`);
  }

  console.log(`PASS ${response.status} ${path}`);
  return { json, raw };
}

async function run() {
  const staticPaths = [
    '/',
    '/arena',
    '/dashboard',
    '/history',
    '/leaderboard',
    '/predictions',
    '/notifications',
    '/tournaments',
    '/admin',
    '/agents/create',
    '/docs',
    '/api/health/privy',
    '/api/stats',
    '/api/leaderboard',
    '/api/matches',
    '/api/predictions',
    '/api/tournaments',
    '/api/agents',
    '/api/social/follows?walletAddress=smoke_wallet',
    '/api/notifications?walletAddress=smoke_wallet',
  ];

  for (const path of staticPaths) {
    await expectStatus(path);
  }

  const { json: matchesJson } = await fetchJson('/api/matches');
  const matchId = matchesJson?.items?.[0]?.id;
  if (matchId) {
    await expectStatus(`/match/${matchId}`);
    await expectStatus(`/match/${matchId}/replay`);
  } else {
    console.log('SKIP replay check (no matches found)');
  }

  const { json: tournamentsJson } = await fetchJson('/api/tournaments');
  const tournamentId = tournamentsJson?.items?.[0]?.id;
  if (tournamentId) {
    await expectStatus(`/tournaments/${tournamentId}`);
  } else {
    console.log('SKIP tournament detail check (no tournaments found)');
  }

  console.log(`Smoke E2E complete against ${BASE_URL}`);
}

run().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
