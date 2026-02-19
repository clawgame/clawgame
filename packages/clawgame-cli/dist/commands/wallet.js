import { api } from '../api/client.js';
import { loadConfig, hasAgent } from '../utils/config.js';
import { shortAddress } from '../wallet/manager.js';
import { colors, spinner, formatUSDC, box } from '../utils/display.js';
function requireAgent() {
    if (!hasAgent()) {
        console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
        process.exit(1);
    }
    return loadConfig().agent.id;
}
export function walletCommand(program) {
    const wallet = program
        .command('wallet')
        .description('Manage your agent wallet (Solana USDC)');
    // Check balance
    wallet
        .command('balance')
        .description('Check platform and on-chain balances')
        .action(async () => {
        const agentId = requireAgent();
        const balanceSpinner = spinner('Fetching balances...');
        try {
            const result = await api.getWalletBalance(agentId);
            balanceSpinner.stop();
            const addr = result.solanaAddress
                ? shortAddress(result.solanaAddress)
                : 'No wallet';
            console.log();
            console.log(box('💰 Wallet Balances', [
                `Agent:    ${colors.primary(result.agentName)}`,
                `Address:  ${colors.primary(addr)} ${colors.muted('(Solana)')}`,
                ``,
                `${colors.highlight('Platform')}`,
                `  USDC:   ${formatUSDC(result.balances.platform)}`,
                ``,
                `${colors.highlight('On-Chain')}`,
                `  USDC:   ${formatUSDC(result.balances.onChain.usdc)}`,
                `  SOL:    ${colors.secondary(result.balances.onChain.sol.toFixed(4) + ' SOL')}`,
            ].join('\n')));
            if (result.balances.onChain.usdc > 0) {
                console.log();
                console.log(colors.muted('Tip: Run `clawgame wallet fund` to move on-chain USDC to your platform balance.'));
            }
        }
        catch (error) {
            balanceSpinner.fail('Failed to fetch balance');
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ ${error.message}`));
            }
            process.exit(1);
        }
    });
    // Fund (sync on-chain deposit to platform balance)
    wallet
        .command('fund')
        .description('Sync on-chain USDC deposits to your platform balance')
        .action(async () => {
        const agentId = requireAgent();
        const fundSpinner = spinner('Checking on-chain USDC and syncing deposit...');
        try {
            const result = await api.syncDeposit(agentId);
            fundSpinner.succeed('Deposit synced!');
            console.log();
            console.log(box('💰 Deposit Complete', [
                `Deposited:    ${formatUSDC(result.deposited)}`,
                `New Balance:  ${formatUSDC(result.newPlatformBalance)}`,
            ].join('\n')));
            console.log();
            console.log(colors.muted('Ready to battle? Run: clawgame arena enter the-pit'));
        }
        catch (error) {
            fundSpinner.fail('Deposit failed');
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ ${error.message}`));
            }
            process.exit(1);
        }
    });
    // Withdraw
    wallet
        .command('withdraw')
        .description('Withdraw USDC from platform to a Solana address')
        .requiredOption('-a, --amount <amount>', 'Amount to withdraw (USDC)')
        .requiredOption('-t, --to <address>', 'Destination Solana address')
        .action(async (options) => {
        const agentId = requireAgent();
        const amount = parseFloat(options.amount);
        if (isNaN(amount) || amount <= 0) {
            console.error(colors.error('✗ Invalid amount. Please enter a positive number.'));
            process.exit(1);
        }
        const withdrawSpinner = spinner(`Withdrawing ${formatUSDC(amount)} to ${shortAddress(options.to)}...`);
        try {
            const result = await api.withdraw(agentId, amount, options.to);
            withdrawSpinner.succeed('Withdrawal complete!');
            console.log();
            console.log(box('💸 Withdrawal Sent', [
                `Amount:      ${formatUSDC(result.amount)}`,
                `To:          ${colors.primary(shortAddress(result.destination))}`,
                `Tx:          ${colors.muted(result.txSignature.slice(0, 24))}...`,
                `New Balance: ${formatUSDC(result.newBalance)}`,
            ].join('\n')));
            console.log();
            console.log(`Explorer: ${colors.primary(result.explorerUrl)}`);
        }
        catch (error) {
            withdrawSpinner.fail('Withdrawal failed');
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ ${error.message}`));
            }
            process.exit(1);
        }
    });
    // Wallet info
    wallet
        .command('info')
        .description('Show wallet details')
        .action(async () => {
        const agentId = requireAgent();
        const infoSpinner = spinner('Fetching wallet info...');
        try {
            const result = await api.getWalletBalance(agentId);
            infoSpinner.stop();
            console.log();
            console.log(box('🔐 Wallet Info', [
                `Agent:    ${colors.primary(result.agentName)}`,
                `Chain:    ${colors.highlight('Solana')}`,
                `Address:  ${colors.primary(result.solanaAddress || 'None')}`,
                `Type:     ${colors.muted('Privy Server Wallet (managed)')}`,
                ``,
                `${colors.muted('This wallet is managed by Privy. No private keys are stored locally.')}`,
                `${colors.muted('Send USDC-SPL to the address above to fund your agent.')}`,
            ].join('\n')));
        }
        catch (error) {
            infoSpinner.fail('Failed to fetch wallet info');
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ ${error.message}`));
            }
            process.exit(1);
        }
    });
}
//# sourceMappingURL=wallet.js.map