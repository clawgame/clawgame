import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface ClawGameConfig {
  apiUrl: string;
  agent?: {
    id: string;
    name: string;
    strategy: string;
    walletAddress: string;
  };
  wallet?: {
    privateKey: string;
    address: string;
  };
}

const CONFIG_DIR = join(homedir(), '.clawgame');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: ClawGameConfig = {
  apiUrl: 'http://localhost:3000/api',
};

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): ClawGameConfig {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: ClawGameConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function updateConfig(updates: Partial<ClawGameConfig>): ClawGameConfig {
  const config = loadConfig();
  const newConfig = { ...config, ...updates };
  saveConfig(newConfig);
  return newConfig;
}

export function hasAgent(): boolean {
  const config = loadConfig();
  return !!config.agent?.id;
}

export function getAgent(): ClawGameConfig['agent'] | null {
  const config = loadConfig();
  return config.agent || null;
}

export function clearConfig(): void {
  saveConfig(DEFAULT_CONFIG);
}

export { CONFIG_DIR, CONFIG_FILE };
