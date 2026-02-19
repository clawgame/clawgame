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
declare const CONFIG_DIR: string;
declare const CONFIG_FILE: string;
export declare function ensureConfigDir(): void;
export declare function loadConfig(): ClawGameConfig;
export declare function saveConfig(config: ClawGameConfig): void;
export declare function updateConfig(updates: Partial<ClawGameConfig>): ClawGameConfig;
export declare function hasAgent(): boolean;
export declare function getAgent(): ClawGameConfig['agent'] | null;
export declare function clearConfig(): void;
export { CONFIG_DIR, CONFIG_FILE };
//# sourceMappingURL=config.d.ts.map