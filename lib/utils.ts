import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format numbers with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// Format currency (USDC)
export function formatUSDC(amount: number): string {
  return `${formatNumber(amount)} USDC`;
}

// Format compact currency
export function formatCompactUSDC(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount}`;
}

// Format percentage
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Format odds
export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

// Calculate potential winnings
export function calculateWinnings(stake: number, odds: number): number {
  return stake * odds;
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

// Format absolute time
export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm:ss');
}

// Format date
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

// Truncate wallet address
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Generate avatar color from string
export function stringToColor(str: string): string {
  const colors = [
    'from-blue-500 to-blue-700',
    'from-purple-500 to-purple-700',
    'from-orange-500 to-orange-700',
    'from-green-500 to-green-700',
    'from-pink-500 to-pink-700',
    'from-cyan-500 to-cyan-700',
    'from-yellow-500 to-yellow-700',
    'from-red-500 to-red-700',
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Generate agent emoji based on strategy
export function getAgentEmoji(strategy?: string): string {
  switch (strategy) {
    case 'aggressive': return '🔥';
    case 'defensive': return '🛡️';
    case 'balanced': return '⚖️';
    case 'chaotic': return '🎲';
    default: return '🤖';
  }
}

// Get arena display info
export function getArenaInfo(arena: string): { name: string; icon: string; color: string } {
  switch (arena) {
    case 'the-pit':
      return { name: 'The Pit', icon: '⚔️', color: 'text-accent-orange' };
    case 'colosseum':
      return { name: 'Colosseum', icon: '🏛️', color: 'text-accent-purple' };
    case 'speed-trade':
      return { name: 'Speed Trade', icon: '⚡', color: 'text-accent-cyan' };
    case 'bazaar':
      return { name: 'Bazaar', icon: '🏪', color: 'text-accent-yellow' };
    default:
      return { name: arena, icon: '🎮', color: 'text-text-secondary' };
  }
}

// Get status display info
export function getStatusInfo(status: string): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'live':
      return { 
        label: 'LIVE', 
        color: 'text-accent-red', 
        bgColor: 'bg-accent-red/10 border-accent-red/30' 
      };
    case 'pending':
      return { 
        label: 'STARTING SOON', 
        color: 'text-accent-yellow', 
        bgColor: 'bg-accent-yellow/10 border-accent-yellow/30' 
      };
    case 'completed':
      return { 
        label: 'COMPLETED', 
        color: 'text-accent-primary', 
        bgColor: 'bg-accent-primary/10 border-accent-primary/30' 
      };
    default:
      return { 
        label: status, 
        color: 'text-text-secondary', 
        bgColor: 'bg-bg-tertiary border-border' 
      };
  }
}

// Calculate win rate
export function calculateWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return (wins / total) * 100;
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Format duration between two dates
export function formatDuration(start: Date, end: Date): string {
  const diff = Math.abs(end.getTime() - start.getTime());
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
