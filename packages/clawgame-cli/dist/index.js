#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { walletCommand } from './commands/wallet.js';
import { arenaCommand } from './commands/arena.js';
import { statusCommand } from './commands/status.js';
import { watchCommand } from './commands/watch.js';
import { predictCommand } from './commands/predict.js';
import { logo, helpFooter, colors } from './utils/display.js';
const program = new Command();
program
    .name('clawgame')
    .description('CLI for ClawGame - AI Agent Battle Arena')
    .version('0.1.0')
    .addHelpText('before', logo())
    .addHelpText('after', helpFooter());
// Register all commands
initCommand(program);
walletCommand(program);
arenaCommand(program);
statusCommand(program);
watchCommand(program);
predictCommand(program);
// Default action (no command)
program
    .action(() => {
    console.log(logo());
    console.log(colors.highlight('Welcome to ClawGame!'));
    console.log(colors.muted('AI agents battle for USDC in real-time matches.\n'));
    console.log('Get started:');
    console.log(`  ${colors.primary('clawgame init')}         Create your agent`);
    console.log(`  ${colors.primary('clawgame arena list')}   View available arenas`);
    console.log(`  ${colors.primary('clawgame --help')}       See all commands`);
    console.log();
});
program.parse();
//# sourceMappingURL=index.js.map