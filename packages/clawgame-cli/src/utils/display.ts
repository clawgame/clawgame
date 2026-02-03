import chalk from 'chalk';
import ora, { Ora } from 'ora';

// Colors matching ClawGame theme
export const colors = {
  primary: chalk.hex('#00D9FF'),    // Cyan accent
  secondary: chalk.hex('#A855F7'),   // Purple accent
  success: chalk.hex('#22C55E'),     // Green
  warning: chalk.hex('#EAB308'),     // Yellow
  error: chalk.hex('#EF4444'),       // Red
  muted: chalk.gray,
  highlight: chalk.bold.white,
};

// Status badges
export function statusBadge(status: string): string {
  const badges: Record<string, string> = {
    live: colors.success('● LIVE'),
    pending: colors.warning('○ PENDING'),
    completed: colors.muted('◉ COMPLETED'),
    cancelled: colors.error('✕ CANCELLED'),
  };
  return badges[status.toLowerCase()] || status;
}

// Strategy badges
export function strategyBadge(strategy: string): string {
  const badges: Record<string, string> = {
    aggressive: colors.error('⚔ AGGRESSIVE'),
    defensive: colors.primary('🛡 DEFENSIVE'),
    balanced: colors.success('⚖ BALANCED'),
    chaotic: colors.secondary('🎲 CHAOTIC'),
  };
  return badges[strategy.toLowerCase()] || strategy;
}

// Arena info
export function arenaInfo(arena: string): { name: string; icon: string; color: typeof colors.primary } {
  const arenas: Record<string, { name: string; icon: string; color: typeof colors.primary }> = {
    'the-pit': { name: 'The Pit', icon: '🔥', color: colors.warning },
    'colosseum': { name: 'Colosseum', icon: '⚔️', color: colors.error },
    'speed-trade': { name: 'Speed Trade', icon: '⚡', color: colors.primary },
  };
  return arenas[arena.toLowerCase()] || { name: arena, icon: '🎮', color: colors.muted };
}

// Format USDC
export function formatUSDC(amount: number): string {
  return colors.success(`$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
}

// Format percentage
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Box drawing
export function box(title: string, content: string): string {
  const lines = content.split('\n');
  const maxWidth = Math.max(title.length + 4, ...lines.map(l => stripAnsi(l).length)) + 4;

  const top = `╭${'─'.repeat(maxWidth - 2)}╮`;
  const titleLine = `│ ${colors.highlight(title)}${' '.repeat(maxWidth - stripAnsi(title).length - 4)} │`;
  const separator = `├${'─'.repeat(maxWidth - 2)}┤`;
  const bottom = `╰${'─'.repeat(maxWidth - 2)}╯`;

  const contentLines = lines.map(line => {
    const padding = maxWidth - stripAnsi(line).length - 4;
    return `│ ${line}${' '.repeat(Math.max(0, padding))} │`;
  });

  return [top, titleLine, separator, ...contentLines, bottom].join('\n');
}

// Table formatting
export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) =>
    Math.max(stripAnsi(h).length, ...rows.map(r => stripAnsi(r[i] || '').length))
  );

  const headerRow = headers.map((h, i) => colors.muted(h.padEnd(colWidths[i]))).join('  ');
  const separator = colWidths.map(w => colors.muted('─'.repeat(w))).join('  ');
  const dataRows = rows.map(row =>
    row.map((cell, i) => (cell || '').padEnd(colWidths[i] + (cell.length - stripAnsi(cell).length))).join('  ')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}

// Strip ANSI codes for length calculation
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// Spinner helpers
export function spinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  }).start();
}

// Logo
export function logo(): string {
  return colors.primary(`
   _____ _                 _____
  / ____| |               / ____|
 | |    | | __ ___      _| |  __  __ _ _ __ ___   ___
 | |    | |/ _\` \\ \\ /\\ / / | |_ |/ _\` | '_ \` _ \\ / _ \\
 | |____| | (_| |\\ V  V /| |__| | (_| | | | | | |  __/
  \\_____|_|\\__,_| \\_/\\_/  \\_____|\\__,_|_| |_| |_|\\___|
`);
}

// Help footer
export function helpFooter(): string {
  return `
${colors.muted('─'.repeat(50))}
${colors.primary('ClawGame')} - AI Agent Battle Arena
${colors.muted('https://clawgame.io')}
`;
}

// Message types for live feed
export function formatMessage(type: string, agentName: string | null, content: string, timestamp?: Date): string {
  const time = timestamp ? colors.muted(`[${timestamp.toLocaleTimeString()}]`) : '';

  switch (type.toLowerCase()) {
    case 'chat':
      return `${time} ${colors.primary(agentName || 'Agent')}: ${content}`;
    case 'offer':
      return `${time} ${colors.warning('💰')} ${colors.highlight(agentName || 'Agent')} offers: ${colors.success(content)}`;
    case 'accept':
      return `${time} ${colors.success('✓')} ${colors.highlight(agentName || 'Agent')} accepts!`;
    case 'reject':
      return `${time} ${colors.error('✗')} ${colors.highlight(agentName || 'Agent')} rejects`;
    case 'system':
      return `${time} ${colors.muted('→')} ${colors.muted(content)}`;
    default:
      return `${time} ${content}`;
  }
}

// Progress bar
export function progressBar(current: number, total: number, width: number = 20): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${total}`;
}
