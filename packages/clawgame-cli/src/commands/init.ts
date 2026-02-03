import { Command } from 'commander';
import inquirer from 'inquirer';
import { api } from '../api/client.js';
import { loadConfig, updateConfig, hasAgent, CONFIG_FILE } from '../utils/config.js';
import { createWallet, shortAddress } from '../wallet/manager.js';
import { colors, spinner, logo, box, strategyBadge } from '../utils/display.js';

const STRATEGIES = [
  { name: '⚔️  Aggressive - Push hard for maximum gains', value: 'aggressive' },
  { name: '🛡️  Defensive - Play it safe, protect your position', value: 'defensive' },
  { name: '⚖️  Balanced - Adapt to each situation', value: 'balanced' },
  { name: '🎲  Chaotic - Unpredictable and creative', value: 'chaotic' },
];

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Create a new ClawGame agent')
    .option('-n, --name <name>', 'Agent name')
    .option('-s, --strategy <strategy>', 'Agent strategy (aggressive, defensive, balanced, chaotic)')
    .option('-b, --bio <bio>', 'Agent bio')
    .option('--force', 'Overwrite existing agent')
    .action(async (options) => {
      console.log(logo());
      console.log(colors.highlight('Welcome to ClawGame!'));
      console.log(colors.muted('Let\'s create your AI agent for the arena.\n'));

      // Check if agent already exists
      if (hasAgent() && !options.force) {
        const config = loadConfig();
        console.log(colors.warning('⚠️  You already have an agent configured:'));
        console.log(`   Name: ${colors.primary(config.agent!.name)}`);
        console.log(`   ID: ${colors.muted(config.agent!.id)}`);
        console.log();
        console.log(colors.muted('Run `clawgame init --force` to create a new agent.'));
        console.log(colors.muted('Run `clawgame status` to see your agent\'s stats.'));
        return;
      }

      try {
        // Interactive prompts
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'What\'s your agent\'s name?',
            default: options.name,
            validate: (input: string) => {
              if (!input || input.trim().length < 2) {
                return 'Name must be at least 2 characters';
              }
              if (input.length > 20) {
                return 'Name must be 20 characters or less';
              }
              if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                return 'Name can only contain letters, numbers, underscores, and hyphens';
              }
              return true;
            },
            when: !options.name,
          },
          {
            type: 'list',
            name: 'strategy',
            message: 'Choose your agent\'s strategy:',
            choices: STRATEGIES,
            when: !options.strategy,
          },
          {
            type: 'input',
            name: 'bio',
            message: 'Write a short bio for your agent:',
            default: options.bio || 'A fierce competitor in the arena.',
            validate: (input: string) => {
              if (input.length > 200) {
                return 'Bio must be 200 characters or less';
              }
              return true;
            },
            when: !options.bio,
          },
        ]);

        const name = options.name || answers.name;
        const strategy = options.strategy || answers.strategy;
        const bio = options.bio || answers.bio;

        console.log();

        // Create wallet
        const walletSpinner = spinner('Creating wallet...');
        const wallet = createWallet();
        walletSpinner.succeed(`Wallet created: ${colors.primary(shortAddress(wallet.address))}`);

        // Register agent with API
        const agentSpinner = spinner('Registering agent...');

        try {
          const agent = await api.registerAgent({
            name,
            strategy: strategy.toUpperCase(),
            bio,
            walletAddress: wallet.address,
          });

          agentSpinner.succeed(`Agent registered: ${colors.primary(agent.name)}`);

          // Save agent to config
          updateConfig({
            agent: {
              id: agent.id,
              name: agent.name,
              strategy: agent.strategy,
              walletAddress: wallet.address,
            },
          });

          // Display success
          console.log();
          console.log(box('🎮 Agent Created!', [
            `Name:     ${colors.primary(agent.name)}`,
            `Strategy: ${strategyBadge(agent.strategy)}`,
            `Rating:   ${colors.highlight(String(agent.rating))}`,
            `Wallet:   ${colors.muted(shortAddress(wallet.address))}`,
            `ID:       ${colors.muted(agent.id)}`,
          ].join('\n')));

          console.log();
          console.log(colors.success('✓ Setup complete!'));
          console.log();
          console.log('Next steps:');
          console.log(`  ${colors.muted('1.')} Fund your wallet: ${colors.primary('clawgame wallet fund --amount 100')}`);
          console.log(`  ${colors.muted('2.')} Enter the arena:  ${colors.primary('clawgame arena enter the-pit')}`);
          console.log(`  ${colors.muted('3.')} Check status:     ${colors.primary('clawgame status')}`);
          console.log();
          console.log(colors.muted(`Config saved to: ${CONFIG_FILE}`));

        } catch (error) {
          agentSpinner.fail('Failed to register agent');
          throw error;
        }

      } catch (error) {
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ Error: ${error.message}`));
        }
        process.exit(1);
      }
    });
}
