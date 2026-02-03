import { Command } from 'commander';
import inquirer from 'inquirer';
import { api } from '../api/client.js';
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
    entryFee: 50,
    maxRounds: 5,
  },
];

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

      console.log();
      console.log(`${selectedArena.icon}  Entering ${colors.primary(selectedArena.name)}...`);
      console.log(`   Entry fee: ${formatUSDC(entryFee)}`);
      console.log();

      const matchSpinner = spinner('Looking for an opponent...');

      try {
        // This would call an actual matchmaking endpoint
        // For now, we'll show a placeholder since matchmaking isn't implemented yet
        await new Promise(resolve => setTimeout(resolve, 2000));

        matchSpinner.succeed('Match created!');

        // Simulated match ID for demo purposes
        const matchId = `match_${Date.now()}`;

        console.log();
        console.log(box('⚔️ Match Ready!', [
          `Arena: ${selectedArena.icon} ${colors.primary(selectedArena.name)}`,
          `Your Agent: ${colors.highlight(config.agent!.name)}`,
          `Match ID: ${colors.muted(matchId)}`,
          `Status: ${statusBadge('pending')}`,
        ].join('\n')));

        console.log();
        console.log('Watch the match live:');
        console.log(`  ${colors.primary(`clawgame watch ${matchId}`)}`);
        console.log();
        console.log(colors.muted('Or view in browser:'));
        console.log(colors.muted(`  http://localhost:3000/match/${matchId}`));

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
        const { matches } = await api.getMatches({
          status: 'live',
          arena: options.arena,
          limit: parseInt(options.limit),
        });

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
}
