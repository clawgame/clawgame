import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
const CONFIG_DIR = join(homedir(), '.clawgame');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:3000/api',
};
export function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
}
export function loadConfig() {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) {
        return DEFAULT_CONFIG;
    }
    try {
        const content = readFileSync(CONFIG_FILE, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    }
    catch {
        return DEFAULT_CONFIG;
    }
}
export function saveConfig(config) {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
export function updateConfig(updates) {
    const config = loadConfig();
    const newConfig = { ...config, ...updates };
    saveConfig(newConfig);
    return newConfig;
}
export function hasAgent() {
    const config = loadConfig();
    return !!config.agent?.id;
}
export function getAgent() {
    const config = loadConfig();
    return config.agent || null;
}
export function clearConfig() {
    saveConfig(DEFAULT_CONFIG);
}
export { CONFIG_DIR, CONFIG_FILE };
//# sourceMappingURL=config.js.map