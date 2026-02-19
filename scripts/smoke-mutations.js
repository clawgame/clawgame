#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const raw = await response.text();
  let json = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  return { response, json, raw };
}

async function expectStatus(path, expectedStatuses, options) {
  const { response, json, raw } = await api(path, options);
  const allowed = Array.isArray(expectedStatuses)
    ? expectedStatuses
    : [expectedStatuses];

  if (!allowed.includes(response.status)) {
    const snippet = json ? JSON.stringify(json).slice(0, 240) : raw.slice(0, 240);
    throw new Error(`${path} expected ${allowed.join('/')} got ${response.status}: ${snippet}`);
  }

  console.log(`PASS ${response.status} ${path}`);
  return { response, json, raw };
}

async function ensureBalance(agentId, minimum) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { user: true },
  });

  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const current = Number(agent.user.balance);
  if (current >= minimum) return;

  await prisma.user.update({
    where: { id: agent.userId },
    data: { balance: { increment: minimum - current } },
  });
}

async function pickAgents() {
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  if (agents.length < 6) {
    throw new Error('Need at least 6 active agents for mutation smoke test');
  }

  return agents;
}

async function runSocialFlow(targetAgentId) {
  const walletAddress = `smoke_social_${Date.now()}`;

  const follow = await expectStatus('/api/social/follows', 200, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      agentId: targetAgentId,
    }),
  });

  if (!follow.json?.isFollowing) {
    throw new Error('Follow response did not mark isFollowing=true');
  }

  const list = await expectStatus(
    `/api/social/follows?walletAddress=${encodeURIComponent(walletAddress)}`,
    200
  );

  const hasFollow = Array.isArray(list.json?.items)
    && list.json.items.some((item) => item.id === targetAgentId);
  if (!hasFollow) {
    throw new Error('Follow list does not include expected agent');
  }

  const unfollow = await expectStatus(
    `/api/social/follows?walletAddress=${encodeURIComponent(walletAddress)}&agentId=${encodeURIComponent(targetAgentId)}`,
    200,
    { method: 'DELETE' }
  );

  if (unfollow.json?.isFollowing !== false) {
    throw new Error('Unfollow response did not mark isFollowing=false');
  }
}

async function runQueueFlow(agentA, agentB) {
  const queueArena = 'bazaar';
  const prizePool = 2.37;

  await ensureBalance(agentA.id, 5);
  await ensureBalance(agentB.id, 5);

  await expectStatus(
    `/api/matches/queue?agentId=${encodeURIComponent(agentA.id)}&arena=${queueArena}`,
    200,
    { method: 'DELETE' }
  );
  await expectStatus(
    `/api/matches/queue?agentId=${encodeURIComponent(agentB.id)}&arena=${queueArena}`,
    200,
    { method: 'DELETE' }
  );

  const joinA = await expectStatus('/api/matches/queue', 200, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      agentId: agentA.id,
      arena: queueArena,
      prizePool,
      maxRounds: 1,
    }),
  });

  if (joinA.json?.status !== 'queued' && joinA.json?.status !== 'matched') {
    throw new Error(`Unexpected queue status for agentA: ${joinA.json?.status || 'unknown'}`);
  }

  const joinB = await expectStatus('/api/matches/queue', 200, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      agentId: agentB.id,
      arena: queueArena,
      prizePool,
      maxRounds: 1,
    }),
  });

  const matchId = joinB.json?.match?.id || joinA.json?.match?.id || null;
  if (!matchId) {
    throw new Error('Queue flow did not produce a matched match ID');
  }

  return matchId;
}

async function runChatFlow(matchId) {
  const walletAddress = `smoke_chat_${Date.now()}`;
  const content = `smoke chat ${Date.now()}`;

  await expectStatus(`/api/matches/${matchId}/chat`, 201, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      content,
      senderName: 'SmokeTest',
    }),
  });

  const chat = await expectStatus(`/api/matches/${matchId}/chat`, 200);
  const hasMessage = Array.isArray(chat.json?.items)
    && chat.json.items.some((message) => message.content === content);

  if (!hasMessage) {
    throw new Error('Posted chat message not found in chat feed');
  }
}

async function runTournamentFlow(agentIds) {
  const [seed1, seed2, join1, join2] = agentIds;

  const create = await expectStatus('/api/tournaments', 201, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `Smoke Tournament ${Date.now()}`,
      arena: 'speed-trade',
      maxParticipants: 4,
      agentIds: [seed1, seed2],
    }),
  });

  const tournamentId = create.json?.tournament?.id;
  if (!tournamentId) {
    throw new Error('Tournament creation did not return tournament ID');
  }

  await expectStatus(`/api/tournaments/${tournamentId}/join`, [200, 201], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agentId: join1 }),
  });

  await expectStatus(`/api/tournaments/${tournamentId}/join`, [200, 201], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agentId: join2 }),
  });

  await expectStatus(`/api/tournaments/${tournamentId}/start`, 201, {
    method: 'POST',
  });

  let completed = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const sync = await expectStatus(`/api/tournaments/${tournamentId}/sync`, 200, {
      method: 'POST',
    });

    if (sync.json?.completed || sync.json?.status === 'COMPLETED') {
      completed = true;
      break;
    }

    await sleep(2000);
  }

  if (!completed) {
    throw new Error('Tournament did not complete within polling window');
  }

  const details = await expectStatus(`/api/tournaments/${tournamentId}`, 200);
  if (details.json?.tournament?.status !== 'completed') {
    throw new Error(`Tournament final status is not completed: ${details.json?.tournament?.status}`);
  }
}

async function run() {
  await expectStatus('/api/health/privy', 200);

  const agents = await pickAgents();

  await runSocialFlow(agents[0].id);

  const queueAgents = agents.slice(0, 2);
  const matchId = await runQueueFlow(queueAgents[0], queueAgents[1]);
  await runChatFlow(matchId);

  const tournamentAgents = agents.slice(2, 6).map((agent) => agent.id);
  await runTournamentFlow(tournamentAgents);

  console.log(`Mutation smoke E2E complete against ${BASE_URL}`);
}

run()
  .catch((error) => {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
