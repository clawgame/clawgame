import { Command } from 'commander';
import inquirer from 'inquirer';
import { api, Market, Bet } from '../api/client.js';
import { loadConfig, hasAgent } from '../utils/config.js';
import { colors, spinner, formatUSDC, box, table, statusBadge } from '../utils/display.js';

function formatOdds(odds: number): string {
  return odds >= 2 ? colors.success(`${odds.toFixed(2)}x`) : colors.warning(`${odds.toFixed(2)}x`);
}

function formatProbability(prob: number): string {
  const pct = (prob * 100).toFixed(0);
  if (prob >= 0.6) return colors.success(`${pct}%`);
  if (prob >= 0.4) return colors.warning(`${pct}%`);
  return colors.error(`${pct}%`);
}

export function predictCommand(program: Command): void {
  const predict = program
    .command('predict')
    .description('Prediction markets - bet on match outcomes');

  // List markets
  predict
    .command('markets')
    .description('List open prediction markets')
    .option('-m, --match <matchId>', 'Filter by match')
    .option('-s, --status <status>', 'Filter by status (open, closed, resolved)', 'open')
    .action(async (options) => {
      const marketsSpinner = spinner('Fetching markets...');

      try {
        const { markets } = await api.getMarkets({
          matchId: options.match,
          status: options.status,
        });

        marketsSpinner.stop();

        if (markets.length === 0) {
          console.log();
          console.log(colors.muted('No prediction markets found.'));
          console.log(colors.muted('Markets are created when matches start.'));
          return;
        }

        console.log();
        console.log(colors.highlight(`📊 Prediction Markets (${options.status})`));
        console.log();

        for (const market of markets) {
          console.log(box(`🎯 ${market.question}`, [
            `Pool: ${formatUSDC(market.totalPool)}`,
            `Status: ${statusBadge(market.status)}`,
            `Market ID: ${colors.muted(market.id.slice(0, 8))}`,
          ].join('\n')));

          console.log();
          console.log('  Options:');

          for (const option of market.options) {
            const bar = '█'.repeat(Math.round(option.probability * 20));
            const empty = '░'.repeat(20 - Math.round(option.probability * 20));
            console.log(`    ${colors.primary(option.label.padEnd(15))} [${bar}${empty}] ${formatProbability(option.probability)} @ ${formatOdds(option.odds)}`);
          }

          console.log();
        }

        console.log(colors.muted('Place a bet: clawgame predict bet <market-id>'));

      } catch (error) {
        marketsSpinner.fail('Failed to fetch markets');
        if (error instanceof Error) {
          console.error(colors.error(`\n${error.message}`));
        }
        process.exit(1);
      }
    });

  // Place bet
  predict
    .command('bet [marketId]')
    .description('Place a bet on a prediction market')
    .option('-a, --amount <amount>', 'Bet amount in USDC')
    .option('-o, --option <optionId>', 'Option to bet on')
    .action(async (marketId, options) => {
      if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const config = loadConfig();

      try {
        // If no market ID provided, show available markets and let user choose
        let selectedMarket: Market;
        let selectedOptionId: string;
        let amount: number;

        if (!marketId) {
          const { markets } = await api.getMarkets({ status: 'open' });

          if (markets.length === 0) {
            console.log(colors.muted('No open markets available.'));
            return;
          }

          const marketAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'market',
            message: 'Select a market to bet on:',
            choices: markets.map(m => ({
              name: `${m.question} (Pool: ${formatUSDC(m.totalPool)})`,
              value: m,
            })),
          }]);

          selectedMarket = marketAnswer.market;
        } else {
          // Fetch specific market
          const { markets } = await api.getMarkets({ status: 'open' });
          const market = markets.find(m => m.id === marketId || m.id.startsWith(marketId));

          if (!market) {
            console.error(colors.error(`✗ Market not found: ${marketId}`));
            process.exit(1);
          }

          selectedMarket = market;
        }

        // Select option
        if (!options.option) {
          const optionAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'option',
            message: 'Which outcome do you predict?',
            choices: selectedMarket.options.map(o => ({
              name: `${o.label} - ${formatProbability(o.probability)} @ ${formatOdds(o.odds)}`,
              value: o.id,
            })),
          }]);

          selectedOptionId = optionAnswer.option;
        } else {
          selectedOptionId = options.option;
        }

        // Get amount
        if (!options.amount) {
          const amountAnswer = await inquirer.prompt([{
            type: 'input',
            name: 'amount',
            message: 'How much USDC do you want to bet?',
            default: '10',
            validate: (input: string) => {
              const num = parseFloat(input);
              if (isNaN(num) || num <= 0) return 'Please enter a valid positive number';
              if (num > 1000) return 'Maximum bet is $1,000 USDC';
              return true;
            },
          }]);

          amount = parseFloat(amountAnswer.amount);
        } else {
          amount = parseFloat(options.amount);
        }

        // Calculate potential winnings
        const selectedOption = selectedMarket.options.find(o => o.id === selectedOptionId);
        const potentialWinnings = amount * (selectedOption?.odds || 1);

        // Confirm bet
        console.log();
        console.log(box('📝 Confirm Bet', [
          `Market: ${selectedMarket.question}`,
          `Prediction: ${colors.primary(selectedOption?.label || 'Unknown')}`,
          `Amount: ${formatUSDC(amount)}`,
          `Odds: ${formatOdds(selectedOption?.odds || 1)}`,
          `Potential Win: ${colors.success(formatUSDC(potentialWinnings))}`,
        ].join('\n')));

        const confirm = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Place this bet?',
          default: true,
        }]);

        if (!confirm.proceed) {
          console.log(colors.muted('Bet cancelled.'));
          return;
        }

        // Place bet
        const betSpinner = spinner('Placing bet...');

        const bet = await api.placeBet({
          marketId: selectedMarket.id,
          optionId: selectedOptionId,
          amount,
          userId: config.agent!.id,
        });

        betSpinner.succeed('Bet placed!');

        console.log();
        console.log(colors.success('✓ Bet confirmed'));
        console.log(`  Bet ID: ${colors.muted(bet.id.slice(0, 8))}`);
        console.log(`  Potential winnings: ${formatUSDC(bet.potentialWinnings)}`);
        console.log();
        console.log(colors.muted('View your bets: clawgame predict bets'));

      } catch (error) {
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });

  // View my bets
  predict
    .command('bets')
    .description('View your placed bets')
    .option('-s, --status <status>', 'Filter by status (pending, won, lost)')
    .action(async (options) => {
      if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const config = loadConfig();
      const betsSpinner = spinner('Fetching your bets...');

      try {
        const { bets, total } = await api.getMyBets(config.agent!.id);

        betsSpinner.stop();

        if (bets.length === 0) {
          console.log();
          console.log(colors.muted('You haven\'t placed any bets yet.'));
          console.log(colors.muted('View markets: clawgame predict markets'));
          return;
        }

        console.log();
        console.log(colors.highlight(`🎲 Your Bets (${total} total)`));
        console.log();

        const rows = bets.map(bet => {
          const statusDisplay = bet.status === 'won'
            ? colors.success('WON')
            : bet.status === 'lost'
              ? colors.error('LOST')
              : colors.warning('PENDING');

          return [
            bet.market?.question?.slice(0, 25) || 'Unknown',
            bet.option?.label || 'Unknown',
            formatUSDC(bet.amount),
            formatUSDC(bet.potentialWinnings),
            statusDisplay,
          ];
        });

        console.log(table(
          ['Market', 'Pick', 'Bet', 'Potential', 'Status'],
          rows
        ));

        // Summary
        const pending = bets.filter(b => b.status === 'pending');
        const won = bets.filter(b => b.status === 'won');

        console.log();
        console.log(colors.muted('─'.repeat(50)));
        console.log(`Active bets: ${pending.length}`);
        console.log(`Total won: ${formatUSDC(won.reduce((sum, b) => sum + b.potentialWinnings, 0))}`);

      } catch (error) {
        betsSpinner.fail('Failed to fetch bets');
        if (error instanceof Error) {
          console.error(colors.error(`\n${error.message}`));
        }
        process.exit(1);
      }
    });
}
