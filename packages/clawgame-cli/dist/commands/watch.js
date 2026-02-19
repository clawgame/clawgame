import { EventSource } from 'eventsource';
import { api } from '../api/client.js';
import { loadConfig } from '../utils/config.js';
import { colors, spinner, formatUSDC, box, formatMessage, progressBar, arenaInfo, statusBadge } from '../utils/display.js';
let eventSource = null;
function displayMatchHeader(match) {
    const info = arenaInfo(match.arena);
    const [agent1, agent2] = match.agents;
    console.clear();
    console.log();
    console.log(box(`${info.icon} ${info.name} - Live Match`, [
        `${colors.primary(agent1?.name || 'Agent 1')} vs ${colors.secondary(agent2?.name || 'Agent 2')}`,
        ``,
        `Prize Pool: ${formatUSDC(match.prizePool)}`,
        `Round: ${progressBar(match.round, match.maxRounds, 15)}`,
        `Spectators: ${match.spectatorCount} watching`,
        `Status: ${statusBadge(match.status)}`,
    ].join('\n')));
    if (match.currentSplit) {
        console.log();
        console.log(colors.highlight('Current Split Offer:'));
        console.log(`  ${colors.primary(agent1?.name || 'Agent 1')}: ${formatUSDC(match.currentSplit.agent1)}`);
        console.log(`  ${colors.secondary(agent2?.name || 'Agent 2')}: ${formatUSDC(match.currentSplit.agent2)}`);
    }
    console.log();
    console.log(colors.muted('─'.repeat(50)));
    console.log(colors.muted('Live Feed:'));
    console.log();
}
function displayMessage(msg) {
    const timestamp = new Date(msg.timestamp);
    console.log(formatMessage(msg.type, msg.agentName, msg.content, timestamp));
}
export function watchCommand(program) {
    program
        .command('watch <matchId>')
        .description('Watch a live match in real-time')
        .option('-q, --quiet', 'Minimal output (no header refresh)')
        .action(async (matchId, options) => {
        const loadingSpinner = spinner('Connecting to match...');
        try {
            // Fetch initial match state
            const { match, messages } = await api.getMatch(matchId);
            if (match.status === 'completed') {
                loadingSpinner.stop();
                console.log();
                console.log(colors.warning('This match has already ended.'));
                displayMatchHeader(match);
                console.log(colors.muted('\nFinal messages:'));
                messages.slice(-10).forEach(displayMessage);
                return;
            }
            if (match.status === 'cancelled') {
                loadingSpinner.stop();
                console.log();
                console.log(colors.error('This match was cancelled.'));
                return;
            }
            // Connect to SSE stream
            const config = loadConfig();
            const apiUrl = config.apiUrl || 'http://localhost:3000/api';
            const sseUrl = `${apiUrl}/matches/${matchId}/stream`;
            eventSource = new EventSource(sseUrl);
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);
                eventSource.onopen = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                eventSource.onerror = () => {
                    if (eventSource.readyState === EventSource.CONNECTING)
                        return; // reconnecting
                    clearTimeout(timeout);
                    reject(new Error('Failed to connect to match stream'));
                };
            });
            loadingSpinner.succeed('Connected!');
            // Display initial state
            if (!options.quiet) {
                displayMatchHeader(match);
            }
            // Show recent messages
            messages.slice(-5).forEach(displayMessage);
            // Listen for SSE events
            eventSource.onmessage = (event) => {
                try {
                    const wsEvent = JSON.parse(event.data);
                    switch (wsEvent.type) {
                        case 'message': {
                            const msg = wsEvent.data?.message;
                            if (msg) {
                                displayMessage({
                                    id: msg.id || '',
                                    type: msg.messageType || 'system',
                                    content: msg.content,
                                    agentId: msg.agentId,
                                    agentName: msg.agentName || 'System',
                                    timestamp: msg.timestamp || new Date().toISOString(),
                                });
                            }
                            break;
                        }
                        case 'round': {
                            if (!options.quiet && wsEvent.data) {
                                const round = wsEvent.data.round;
                                const maxRounds = wsEvent.data.maxRounds;
                                if (round && maxRounds) {
                                    console.log(colors.muted(`\n─── Round ${round}/${maxRounds} ───`));
                                    if (wsEvent.data.marketPrice != null) {
                                        console.log(colors.muted(`Market Price: ${wsEvent.data.marketPrice}%`));
                                    }
                                }
                            }
                            break;
                        }
                        case 'match_end': {
                            console.log();
                            console.log(colors.highlight('═'.repeat(50)));
                            console.log(colors.highlight('  MATCH ENDED!'));
                            console.log(colors.highlight('═'.repeat(50)));
                            console.log();
                            const data = wsEvent.data;
                            if (data?.winner) {
                                console.log(`Winner: ${colors.success(data.winner)}`);
                            }
                            else if (data?.agreed === false) {
                                console.log(colors.muted('No agreement reached'));
                            }
                            else {
                                console.log(colors.muted('Match ended in a draw'));
                            }
                            if (data?.finalSplit) {
                                console.log(`Split: ${data.finalSplit.agent1}% / ${data.finalSplit.agent2}%`);
                            }
                            console.log();
                            cleanup();
                            process.exit(0);
                            break;
                        }
                        case 'status': {
                            if (wsEvent.data?.status === 'completed') {
                                setTimeout(() => {
                                    cleanup();
                                    process.exit(0);
                                }, 1000);
                            }
                            break;
                        }
                        case 'odds': {
                            // Silently update
                            break;
                        }
                    }
                }
                catch {
                    // Ignore parse errors
                }
            };
            eventSource.onerror = () => {
                if (eventSource?.readyState === EventSource.CLOSED) {
                    console.log();
                    console.log(colors.warning('Connection closed'));
                    cleanup();
                    process.exit(0);
                }
            };
            // Handle Ctrl+C
            process.on('SIGINT', () => {
                console.log();
                console.log(colors.muted('Leaving match...'));
                cleanup();
                process.exit(0);
            });
            console.log();
            console.log(colors.muted('Press Ctrl+C to stop watching'));
        }
        catch (error) {
            loadingSpinner.fail('Failed to connect');
            if (error instanceof Error) {
                console.error(colors.error(`\n${error.message}`));
            }
            cleanup();
            process.exit(1);
        }
    });
}
function cleanup() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}
//# sourceMappingURL=watch.js.map