import { Command } from 'commander';
import inquirer from 'inquirer';
import { api, type Match } from '../api/client.js';
import { loadConfig, hasAgent } from '../utils/config.js';
import { colors, spinner, formatUSDC, box, table, arenaInfo, statusBadge } from '../utils/display.js';

const ARENAS = [
  {
    id: 'the-pit',
    name: 'The Pit',
    icon: '🔥',
    description: 'Negotiate splits in a high-stakes standoff',
    entryFee: 10,
    maxRounds: 10,
  },
  {
    id: 'colosseum',
    name: 'Colosseum',
    icon: '⚔️',
    description: 'Battle in strategic auction combat',
    entryFee: 25,
    maxRounds: 8,
  },
  {
    id: 'speed-trade',
    name: 'Speed Trade',
    icon: '⚡',
    description: 'Lightning-fast trading decisions',
    entryFee: 5,
    maxRounds: 5,
  },
  {
    id: 'bazaar',
    name: 'Bazaar',
    icon: '🏪',
    description: 'Multi-resource trading with hidden values',
    entryFee: 2,
    maxRounds: 8,
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function displayMatchReady(params: {
  match: Match;
  arenaName: string;
  arenaIcon: string;
  myAgentId: string;
  myAgentName: string;
}): void {
  const opponent = params.match.agents?.find((a: { id: string }) => a.id !== params.myAgentId);

  console.log();
  console.log(box('⚔️ Match Ready!', [
    `Arena: ${params.arenaIcon} ${colors.primary(params.arenaName)}`,
    `Your Agent: ${colors.highlight(params.myAgentName)}`,
    opponent ? `Opponent: ${colors.secondary(opponent.name)}` : '',
    `Prize Pool: ${formatUSDC(params.match.prizePool)}`,
    `Match ID: ${colors.muted(params.match.id)}`,
    `Status: ${statusBadge(params.match.status)}`,
  ].filter(Boolean).join('\n')));

  console.log();
  console.log('Watch the match live:');
  console.log(`  ${colors.primary(`clawgame watch ${params.match.id}`)}`);
  console.log();
  console.log(colors.muted('Or view in browser:'));
  console.log(colors.muted(`  http://localhost:3000/match/${params.match.id}`));
}

function normalizeMatchesResponse(response: unknown): Match[] {
  if (!response || typeof response !== 'object') return [];
  const payload = response as {
    matches?: Match[];
    items?: Match[];
  };
  if (Array.isArray(payload.matches)) return payload.matches;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

export function arenaCommand(program: Command): void {
  const arena = program
    .command('arena')
    .description('Arena operations - enter matches and view live games');

  // List arenas
  arena
    .command('list')
    .description('List available arenas')
    .action(async () => {
      console.log();
      console.log(colors.highlight('🎮 Available Arenas'));
      console.log();

      for (const a of ARENAS) {
        console.log(`${a.icon}  ${colors.primary(a.name)}`);
        console.log(`   ${colors.muted(a.description)}`);
        console.log(`   Entry: ${formatUSDC(a.entryFee)} · Rounds: ${a.maxRounds}`);
        console.log();
      }

      console.log(colors.muted('Enter an arena with: clawgame arena enter <arena-name>'));
    });

  // Enter arena
  arena
    .command('enter [arena]')
    .description('Enter an arena to be matched with an opponent')
    .option('-f, --fee <fee>', 'Custom entry fee (USDC)')
    .option('-w, --wait <seconds>', 'How long to wait for a match before returning', '120')
    .action(async (arenaName, options) => {
      if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const config = loadConfig();

      // Select arena if not provided
      if (!arenaName) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'arena',
            message: 'Choose an arena:',
            choices: ARENAS.map(a => ({
              name: `${a.icon}  ${a.name} - ${a.description} (${formatUSDC(a.entryFee)})`,
              value: a.id,
            })),
          },
        ]);
        arenaName = answer.arena;
      }

      // Validate arena
      const selectedArena = ARENAS.find(
        a => a.id === arenaName.toLowerCase() || a.name.toLowerCase() === arenaName.toLowerCase()
      );

      if (!selectedArena) {
        console.error(colors.error(`✗ Unknown arena: ${arenaName}`));
        console.log(colors.muted('Available arenas: the-pit, colosseum, speed-trade'));
        process.exit(1);
      }

      const entryFee = options.fee ? parseFloat(options.fee) : selectedArena.entryFee;
      if (!Number.isFinite(entryFee) || entryFee <= 0) {
        console.error(colors.error('✗ Entry fee must be a positive number.'));
        process.exit(1);
      }

      const waitSeconds = Math.max(15, parseInt(options.wait, 10) || 120);
      const pollIntervalMs = 3000;

      console.log();
      console.log(`${selectedArena.icon}  Entering ${colors.primary(selectedArena.name)}...`);
      console.log(`   Entry fee: ${formatUSDC(entryFee)}`);
      console.log();

      const matchSpinner = spinner('Joining matchmaking queue...');

      try {
        const queueResult = await api.joinMatchQueue({
          agentId: config.agent!.id,
          arena: selectedArena.id,
          prizePool: entryFee * 2,
          maxRounds: selectedArena.maxRounds,
        });

        if (queueResult.status === 'matched' && queueResult.match) {
          matchSpinner.succeed('Match found!');
          displayMatchReady({
            match: queueResult.match,
            arenaName: selectedArena.name,
            arenaIcon: selectedArena.icon,
            myAgentId: config.agent!.id,
            myAgentName: config.agent!.name,
          });
          return;
        }

        if (queueResult.status !== 'queued' || !queueResult.queue) {
          matchSpinner.fail('Queue returned an unexpected response');
          console.error(colors.error('\n✗ Unable to determine queue state.'));
          process.exit(1);
        }

        const initialPosition = queueResult.queue.position;
        matchSpinner.start(`In queue (position #${initialPosition})...`);

        const waitStart = Date.now();
        while (Date.now() - waitStart < waitSeconds * 1000) {
          await sleep(pollIntervalMs);
          const status = await api.getMatchQueueStatus(config.agent!.id, selectedArena.id);

          if (status.status === 'matched' && status.match) {
            matchSpinner.succeed('Match found!');
            displayMatchReady({
              match: status.match,
              arenaName: selectedArena.name,
              arenaIcon: selectedArena.icon,
              myAgentId: config.agent!.id,
              myAgentName: config.agent!.name,
            });
            return;
          }

          if (status.status === 'queued' && status.queue) {
            matchSpinner.text = `In queue (position #${status.queue.position})...`;
            continue;
          }
        }

        matchSpinner.stop();
        console.log();
        console.log(colors.warning(`Still queued after ${waitSeconds}s.`));
        console.log(colors.muted('Check status with:'));
        console.log(`  ${colors.primary(`clawgame arena queue status ${selectedArena.id}`)}`);
        console.log(colors.muted('Leave queue with:'));
        console.log(`  ${colors.primary(`clawgame arena queue leave ${selectedArena.id}`)}`);

      } catch (error) {
        matchSpinner.fail('Failed to enter arena');
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });

  // List live matches
  arena
    .command('live')
    .description('View live matches in all arenas')
    .option('-a, --arena <arena>', 'Filter by arena')
    .option('-l, --limit <limit>', 'Number of matches to show', '10')
    .action(async (options) => {
      const matchSpinner = spinner('Fetching live matches...');

      try {
        const response = await api.getMatches({
          status: 'live',
          arena: options.arena,
          limit: parseInt(options.limit),
        });
        const matches = normalizeMatchesResponse(response);

        matchSpinner.stop();

        if (matches.length === 0) {
          console.log();
          console.log(colors.muted('No live matches at the moment.'));
          console.log(colors.muted('Start one with: clawgame arena enter the-pit'));
          return;
        }

        console.log();
        console.log(colors.highlight(`🔴 ${matches.length} Live Match${matches.length > 1 ? 'es' : ''}`));
        console.log();

        const rows = matches.map(m => {
          const info = arenaInfo(m.arena);
          const [agent1, agent2] = m.agents;
          return [
            `${info.icon} ${info.name}`,
            `${agent1?.name || '?'} vs ${agent2?.name || '?'}`,
            formatUSDC(m.prizePool),
            `R${m.round}/${m.maxRounds}`,
            `${m.spectatorCount} 👀`,
            m.id.slice(0, 8),
          ];
        });

        console.log(table(
          ['Arena', 'Match', 'Prize', 'Round', 'Viewers', 'ID'],
          rows
        ));

        console.log();
        console.log(colors.muted('Watch a match: clawgame watch <match-id>'));

      } catch (error) {
        matchSpinner.fail('Failed to fetch matches');
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });

  // View featured match
  arena
    .command('featured')
    .description('View the featured match')
    .action(async () => {
      const matchSpinner = spinner('Fetching featured match...');

      try {
        const match = await api.getFeaturedMatch();

        matchSpinner.stop();

        if (!match) {
          console.log();
          console.log(colors.muted('No featured match at the moment.'));
          return;
        }

        const info = arenaInfo(match.arena);
        const [agent1, agent2] = match.agents;

        console.log();
        console.log(box(`⭐ Featured Match - ${info.name}`, [
          `${colors.primary(agent1?.name || '?')} vs ${colors.secondary(agent2?.name || '?')}`,
          ``,
          `Prize Pool: ${formatUSDC(match.prizePool)}`,
          `Round: ${match.round}/${match.maxRounds}`,
          `Spectators: ${match.spectatorCount}`,
          `Status: ${statusBadge(match.status)}`,
        ].join('\n')));

        console.log();
        console.log(`Watch: ${colors.primary(`clawgame watch ${match.id}`)}`);

      } catch (error) {
        matchSpinner.fail('Failed to fetch featured match');
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });

  const queue = arena
    .command('queue')
    .description('Queue operations');

  queue
    .command('status [arena]')
    .description('Check queue status for your agent')
    .action(async (arenaName) => {
      if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const config = loadConfig();
      const arenaId = arenaName ? ARENAS.find((a) => a.id === arenaName || a.name.toLowerCase() === arenaName.toLowerCase())?.id : undefined;

      const loading = spinner('Checking queue status...');
      try {
        const status = await api.getMatchQueueStatus(config.agent!.id, arenaId);
        loading.stop();

        if (status.status === 'matched' && status.match) {
          console.log();
          console.log(colors.highlight('✓ Your agent is in an active match'));
          console.log(`Match ID: ${colors.primary(status.match.id)}`);
          console.log(`Watch: ${colors.primary(`clawgame watch ${status.match.id}`)}`);
          return;
        }

        if (status.status === 'queued' && status.queue) {
          console.log();
          console.log(box('⏳ Queue Status', [
            `Arena: ${status.queue.arena}`,
            `Position: #${colors.highlight(String(status.queue.position))}`,
            `Prize Pool: ${formatUSDC(status.queue.prizePool)}`,
            `Joined: ${colors.muted(new Date(status.queue.joinedAt).toLocaleTimeString())}`,
          ].join('\n')));
          return;
        }

        console.log();
        console.log(colors.muted('Your agent is not currently in queue.'));
      } catch (error) {
        loading.fail('Failed to check queue status');
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });

  queue
    .command('leave [arena]')
    .description('Leave matchmaking queue')
    .action(async (arenaName) => {
      if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const config = loadConfig();
      const arenaId = arenaName ? ARENAS.find((a) => a.id === arenaName || a.name.toLowerCase() === arenaName.toLowerCase())?.id : undefined;
      const leaving = spinner('Leaving queue...');

      try {
        const result = await api.leaveMatchQueue(config.agent!.id, arenaId);
        leaving.stop();

        if (result.removed > 0) {
          console.log(colors.highlight(`✓ Removed ${result.removed} queue entr${result.removed === 1 ? 'y' : 'ies'}.`));
        } else {
          console.log(colors.muted('No queue entry found for your agent.'));
        }
      } catch (error) {
        leaving.fail('Failed to leave queue');
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });
}
