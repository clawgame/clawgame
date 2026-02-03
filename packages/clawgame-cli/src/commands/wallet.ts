import { Command } from 'commander';
import { api } from '../api/client.js';
import { loadConfig, hasAgent } from '../utils/config.js';
import { loadWallet, shortAddress } from '../wallet/manager.js';
import { colors, spinner, formatUSDC, box } from '../utils/display.js';

export function walletCommand(program: Command): void {
  const wallet = program
    .command('wallet')
    .description('Manage your wallet');

  // Fund wallet
  wallet
    .command('fund')
    .description('Add funds to your wallet (simulated)')
    .requiredOption('-a, --amount <amount>', 'Amount to deposit (USDC)')
    .action(async (options) => {
      if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const amount = parseFloat(options.amount);
      if (isNaN(amount) || amount <= 0) {
        console.error(colors.error('✗ Invalid amount. Please enter a positive number.'));
        process.exit(1);
      }

      if (amount > 10000) {
        console.error(colors.error('✗ Maximum deposit is $10,000 USDC.'));
        process.exit(1);
      }

      const config = loadConfig();
      const walletInfo = loadWallet();

      if (!walletInfo) {
        console.error(colors.error('✗ No wallet found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const fundSpinner = spinner(`Depositing ${formatUSDC(amount)}...`);

      try {
        const result = await api.fundWallet(config.agent!.id, amount);
        fundSpinner.succeed('Deposit successful!');

        console.log();
        console.log(box('💰 Wallet Funded', [
          `Deposited: ${formatUSDC(amount)}`,
          `New Balance: ${formatUSDC(result.balance)}`,
          `Transaction: ${colors.muted(result.transaction.slice(0, 16))}...`,
        ].join('\n')));

        console.log();
        console.log(colors.muted('Ready to battle? Run: clawgame arena enter the-pit'));

      } catch (error) {
        fundSpinner.fail('Deposit failed');
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });

  // Check balance
  wallet
    .command('balance')
    .description('Check your wallet balance')
    .action(async () => {
      if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const config = loadConfig();
      const walletInfo = loadWallet();

      if (!walletInfo) {
        console.error(colors.error('✗ No wallet found. Run `clawgame init` first.'));
        process.exit(1);
      }

      const balanceSpinner = spinner('Fetching balance...');

      try {
        const result = await api.getBalance(config.agent!.id);
        balanceSpinner.stop();

        console.log();
        console.log(box('💰 Wallet', [
          `Address: ${colors.primary(shortAddress(walletInfo.address))}`,
          `Balance: ${formatUSDC(result.balance)}`,
        ].join('\n')));

      } catch (error) {
        balanceSpinner.fail('Failed to fetch balance');
        if (error instanceof Error) {
          console.error(colors.error(`\n✗ ${error.message}`));
        }
        process.exit(1);
      }
    });

  // Show wallet info
  wallet
    .command('info')
    .description('Show wallet details')
    .option('--show-private-key', 'Show private key (dangerous!)')
    .action((options) => {
      const walletInfo = loadWallet();

      if (!walletInfo) {
        console.error(colors.error('✗ No wallet found. Run `clawgame init` first.'));
        process.exit(1);
      }

      console.log();
      console.log(box('🔐 Wallet Info', [
        `Address: ${colors.primary(walletInfo.address)}`,
        options.showPrivateKey
          ? `Private Key: ${colors.error(walletInfo.privateKey)}`
          : `Private Key: ${colors.muted('[hidden - use --show-private-key]')}`,
      ].join('\n')));

      if (options.showPrivateKey) {
        console.log();
        console.log(colors.warning('⚠️  Never share your private key with anyone!'));
      }
    });

  // Export wallet
  wallet
    .command('export')
    .description('Export wallet private key')
    .action(async () => {
      const walletInfo = loadWallet();

      if (!walletInfo) {
        console.error(colors.error('✗ No wallet found. Run `clawgame init` first.'));
        process.exit(1);
      }

      console.log();
      console.log(colors.warning('⚠️  WARNING: Never share your private key with anyone!'));
      console.log(colors.warning('   Anyone with this key can access your funds.'));
      console.log();
      console.log(`Address:     ${colors.primary(walletInfo.address)}`);
      console.log(`Private Key: ${colors.error(walletInfo.privateKey)}`);
      console.log();
      console.log(colors.muted('You can import this wallet into MetaMask or any other wallet.'));
    });
}
