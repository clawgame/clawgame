import { readFileSync } from 'fs';
import inquirer from 'inquirer';
import { api } from '../api/client.js';
import { loadConfig, updateConfig, hasAgent, CONFIG_FILE } from '../utils/config.js';
import { shortAddress } from '../wallet/manager.js';
import { colors, spinner, logo, box, strategyBadge } from '../utils/display.js';
const STRATEGIES = [
    { name: '⚔️  Aggressive - Push hard for maximum gains', value: 'aggressive' },
    { name: '🛡️  Defensive - Play it safe, protect your position', value: 'defensive' },
    { name: '⚖️  Balanced - Adapt to each situation', value: 'balanced' },
    { name: '🎲  Chaotic - Unpredictable and creative', value: 'chaotic' },
    { name: '🧬  Custom - Define your own strategy parameters', value: 'custom' },
];
export function initCommand(program) {
    program
        .command('init')
        .description('Create a new ClawGame agent')
        .option('-n, --name <name>', 'Agent name')
        .option('-s, --strategy <strategy>', 'Agent strategy (aggressive, defensive, balanced, chaotic, custom)')
        .option('-b, --bio <bio>', 'Agent bio')
        .option('--strategy-config <path>', 'Path to custom strategy JSON file')
        .option('--force', 'Overwrite existing agent')
        .action(async (options) => {
        console.log(logo());
        console.log(colors.highlight('Welcome to ClawGame!'));
        console.log(colors.muted('Let\'s create your AI agent for the arena.\n'));
        // Check if agent already exists
        if (hasAgent() && !options.force) {
            const config = loadConfig();
            console.log(colors.warning('⚠️  You already have an agent configured:'));
            console.log(`   Name: ${colors.primary(config.agent.name)}`);
            console.log(`   ID: ${colors.muted(config.agent.id)}`);
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
                    validate: (input) => {
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
                    validate: (input) => {
                        if (input.length > 200) {
                            return 'Bio must be 200 characters or less';
                        }
                        return true;
                    },
                    when: !options.bio,
                },
            ]);
            const name = options.name || answers.name;
            let strategy = options.strategy || answers.strategy;
            const bio = options.bio || answers.bio;
            let strategyConfig;
            // Handle --strategy-config flag (JSON file)
            if (options.strategyConfig) {
                try {
                    const raw = readFileSync(options.strategyConfig, 'utf-8');
                    strategyConfig = JSON.parse(raw);
                    strategy = 'custom';
                    console.log(colors.success(`\n✓ Loaded strategy config from ${options.strategyConfig}`));
                }
                catch (err) {
                    console.error(colors.error(`\n✗ Failed to read strategy config: ${err instanceof Error ? err.message : err}`));
                    process.exit(1);
                }
            }
            // Interactive custom strategy tuning
            if (strategy === 'custom' && !strategyConfig) {
                console.log();
                console.log(colors.highlight('Custom Strategy Configuration'));
                console.log(colors.muted('Tune your agent\'s negotiation parameters.\n'));
                const customAnswers = await inquirer.prompt([
                    {
                        type: 'number',
                        name: 'openingBase',
                        message: 'Opening offer base % (35-75, what you ask for):',
                        default: 54,
                        validate: (v) => (v >= 35 && v <= 75) || 'Must be 35-75',
                    },
                    {
                        type: 'number',
                        name: 'floorBase',
                        message: 'Floor % (30-60, minimum you\'ll accept):',
                        default: 45,
                        validate: (v) => (v >= 30 && v <= 60) || 'Must be 30-60',
                    },
                    {
                        type: 'number',
                        name: 'concessionMin',
                        message: 'Min concession per round (-5 to 10):',
                        default: 1.0,
                        validate: (v) => (v >= -5 && v <= 10) || 'Must be -5 to 10',
                    },
                    {
                        type: 'number',
                        name: 'concessionMax',
                        message: 'Max concession per round (-5 to 10):',
                        default: 3.0,
                        validate: (v) => (v >= -5 && v <= 10) || 'Must be -5 to 10',
                    },
                    {
                        type: 'number',
                        name: 'bluffProbability',
                        message: 'Bluff probability (0.0-1.0):',
                        default: 0.25,
                        validate: (v) => (v >= 0 && v <= 1) || 'Must be 0.0-1.0',
                    },
                    {
                        type: 'number',
                        name: 'emotionalVolatility',
                        message: 'Emotional volatility (0.0-1.0, randomness):',
                        default: 0.5,
                        validate: (v) => (v >= 0 && v <= 1) || 'Must be 0.0-1.0',
                    },
                    {
                        type: 'number',
                        name: 'timePreferencePressure',
                        message: 'Time pressure sensitivity (0.0-1.0):',
                        default: 0.6,
                        validate: (v) => (v >= 0 && v <= 1) || 'Must be 0.0-1.0',
                    },
                ]);
                strategyConfig = {
                    openingOffer: { base: customAnswers.openingBase },
                    concession: { min: customAnswers.concessionMin, max: customAnswers.concessionMax },
                    floor: { base: customAnswers.floorBase },
                    bluffProbability: customAnswers.bluffProbability,
                    emotionalVolatility: customAnswers.emotionalVolatility,
                    timePreferencePressure: customAnswers.timePreferencePressure,
                };
            }
            console.log();
            // Register agent with API (server creates Privy Solana wallet)
            const agentSpinner = spinner('Registering agent and creating Solana wallet...');
            try {
                const agent = await api.registerAgent({
                    name,
                    strategy: strategy.toUpperCase(),
                    bio,
                    ...(strategyConfig ? { strategyConfig } : {}),
                });
                agentSpinner.succeed(`Agent registered: ${colors.primary(agent.name)}`);
                // Save agent to config
                updateConfig({
                    agent: {
                        id: agent.id,
                        name: agent.name,
                        strategy: agent.strategy,
                        walletAddress: agent.solanaAddress || '',
                    },
                });
                // Display success
                const solAddr = agent.solanaAddress
                    ? shortAddress(agent.solanaAddress)
                    : 'Pending...';
                console.log();
                console.log(box('🎮 Agent Created!', [
                    `Name:     ${colors.primary(agent.name)}`,
                    `Strategy: ${strategyBadge(agent.strategy)}`,
                    `Rating:   ${colors.highlight(String(agent.rating))}`,
                    `Wallet:   ${colors.primary(solAddr)} ${colors.muted('(Solana)')}`,
                    `ID:       ${colors.muted(agent.id)}`,
                ].join('\n')));
                if (agent.solanaAddress) {
                    console.log();
                    console.log(colors.muted(`Full Solana address: ${agent.solanaAddress}`));
                }
                console.log();
                console.log(colors.success('✓ Setup complete!'));
                console.log();
                console.log('Next steps:');
                console.log(`  ${colors.muted('1.')} Check balance:     ${colors.primary('clawgame wallet balance')}`);
                console.log(`  ${colors.muted('2.')} Fund your wallet:  ${colors.muted('Send USDC to your Solana address, then run')} ${colors.primary('clawgame wallet fund')}`);
                console.log(`  ${colors.muted('3.')} Enter the arena:   ${colors.primary('clawgame arena enter the-pit')}`);
                console.log();
                console.log(colors.muted(`Config saved to: ${CONFIG_FILE}`));
            }
            catch (error) {
                agentSpinner.fail('Failed to register agent');
                throw error;
            }
        }
        catch (error) {
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ Error: ${error.message}`));
            }
            process.exit(1);
        }
    });
}
//# sourceMappingURL=init.js.map