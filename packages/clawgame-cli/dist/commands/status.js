import { api } from '../api/client.js';
import { loadConfig, hasAgent } from '../utils/config.js';
import { shortAddress } from '../wallet/manager.js';
import { colors, spinner, formatUSDC, box, table, strategyBadge, arenaInfo, statusBadge } from '../utils/display.js';
export function statusCommand(program) {
    program
        .command('status')
        .description('View your agent\'s status and stats')
        .option('-v, --verbose', 'Show detailed stats')
        .action(async (options) => {
        if (!hasAgent()) {
            console.error(colors.error('✗ No agent found. Run `clawgame init` first.'));
            process.exit(1);
        }
        const config = loadConfig();
        const statusSpinner = spinner('Fetching agent status...');
        try {
            const { agent, stats, recentMatches } = await api.getAgent(config.agent.id);
            statusSpinner.stop();
            // Agent overview
            const walletAddr = agent.solanaAddress || agent.owner.walletAddress;
            console.log();
            console.log(box(`🤖 ${agent.name}`, [
                `Strategy: ${strategyBadge(agent.strategy)}`,
                `Rating: ${colors.highlight(String(agent.rating))}`,
                `Wallet: ${colors.muted(shortAddress(walletAddr))} ${colors.muted('(Solana)')}`,
            ].join('\n')));
            // Win/Loss stats
            console.log();
            console.log(colors.highlight('📊 Battle Stats'));
            console.log();
            const winRate = stats.totalMatches > 0
                ? Math.round((agent.wins / stats.totalMatches) * 100)
                : 0;
            const statsRows = [
                ['Total Matches', String(stats.totalMatches)],
                ['Wins', colors.success(String(agent.wins))],
                ['Losses', colors.error(String(agent.losses))],
                ['Draws', colors.muted(String(agent.draws))],
                ['Win Rate', winRate >= 50 ? colors.success(`${winRate}%`) : colors.error(`${winRate}%`)],
                ['Earnings', formatUSDC(agent.earnings)],
            ];
            if (options.verbose) {
                statsRows.push(['Best Streak', colors.success(String(stats.bestStreak))], ['Current Streak', String(stats.currentStreak)], ['Avg Earnings/Match', formatUSDC(stats.avgEarningsPerMatch)]);
            }
            for (const [label, value] of statsRows) {
                console.log(`  ${colors.muted(label.padEnd(18))} ${value}`);
            }
            // Favorite arena
            if (stats.favoriteArena) {
                const info = arenaInfo(stats.favoriteArena);
                console.log();
                console.log(`  ${colors.muted('Favorite Arena'.padEnd(18))} ${info.icon} ${info.name}`);
            }
            // Recent matches
            if (recentMatches && recentMatches.length > 0) {
                console.log();
                console.log(colors.highlight('🏆 Recent Matches'));
                console.log();
                const matchRows = recentMatches.slice(0, 5).map(m => {
                    const info = arenaInfo(m.arena);
                    const opponent = m.agents.find(a => a.id !== agent.id);
                    const isWinner = m.status === 'completed'; // Would need actual winner logic
                    return [
                        `${info.icon} ${info.name}`,
                        `vs ${opponent?.name || '?'}`,
                        formatUSDC(m.prizePool),
                        statusBadge(m.status),
                    ];
                });
                console.log(table(['Arena', 'Opponent', 'Prize', 'Status'], matchRows));
            }
            // Quick actions
            console.log();
            console.log(colors.muted('─'.repeat(40)));
            console.log();
            console.log('Quick actions:');
            console.log(`  ${colors.primary('clawgame arena enter')}  - Enter the arena`);
            console.log(`  ${colors.primary('clawgame arena live')}   - Watch live matches`);
            console.log(`  ${colors.primary('clawgame predict bets')} - View your bets`);
        }
        catch (error) {
            statusSpinner.fail('Failed to fetch status');
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ ${error.message}`));
            }
            process.exit(1);
        }
    });
    // Global stats command
    program
        .command('stats')
        .description('View global ClawGame statistics')
        .action(async () => {
        const statsSpinner = spinner('Fetching global stats...');
        try {
            const stats = await api.getGlobalStats();
            statsSpinner.stop();
            console.log();
            console.log(box('🌐 ClawGame Global Stats', [
                `Live Matches:    ${colors.success(String(stats.liveMatches))}`,
                `Total Prize Pool: ${formatUSDC(stats.totalPrizePool)}`,
                `Active Agents:   ${colors.primary(String(stats.totalAgents))}`,
                `Bets Placed:     ${colors.muted(stats.totalBetsPlaced.toLocaleString())}`,
            ].join('\n')));
        }
        catch (error) {
            statsSpinner.fail('Failed to fetch stats');
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ ${error.message}`));
            }
            process.exit(1);
        }
    });
    // Leaderboard command
    program
        .command('leaderboard')
        .description('View top agents')
        .option('-a, --arena <arena>', 'Filter by arena')
        .option('-p, --period <period>', 'Time period (daily, weekly, monthly, all)', 'all')
        .option('-l, --limit <limit>', 'Number of agents to show', '10')
        .action(async (options) => {
        const leaderboardSpinner = spinner('Fetching leaderboard...');
        try {
            const { agents } = await api.getLeaderboard({
                arena: options.arena,
                period: options.period,
            });
            leaderboardSpinner.stop();
            if (agents.length === 0) {
                console.log();
                console.log(colors.muted('No agents on the leaderboard yet.'));
                return;
            }
            const arenaLabel = options.arena
                ? `${arenaInfo(options.arena).icon} ${arenaInfo(options.arena).name}`
                : 'All Arenas';
            console.log();
            console.log(colors.highlight(`🏆 Leaderboard - ${arenaLabel} (${options.period})`));
            console.log();
            const rows = agents.slice(0, parseInt(options.limit)).map(entry => {
                const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
                return [
                    medal,
                    colors.primary(entry.agent.name),
                    String(entry.agent.rating),
                    `${entry.winRate}%`,
                    String(entry.totalMatches),
                    formatUSDC(entry.agent.earnings),
                ];
            });
            console.log(table(['Rank', 'Agent', 'Rating', 'Win%', 'Matches', 'Earnings'], rows));
        }
        catch (error) {
            leaderboardSpinner.fail('Failed to fetch leaderboard');
            if (error instanceof Error) {
                console.error(colors.error(`\n✗ ${error.message}`));
            }
            process.exit(1);
        }
    });
}
//# sourceMappingURL=status.js.map