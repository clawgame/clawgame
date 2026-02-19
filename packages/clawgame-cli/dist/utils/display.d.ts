import { Ora } from 'ora';
export declare const colors: {
    primary: import("chalk").ChalkInstance;
    secondary: import("chalk").ChalkInstance;
    success: import("chalk").ChalkInstance;
    warning: import("chalk").ChalkInstance;
    error: import("chalk").ChalkInstance;
    muted: import("chalk").ChalkInstance;
    highlight: import("chalk").ChalkInstance;
};
export declare function statusBadge(status: string): string;
export declare function strategyBadge(strategy: string): string;
export declare function arenaInfo(arena: string): {
    name: string;
    icon: string;
    color: typeof colors.primary;
};
export declare function formatUSDC(amount: number): string;
export declare function formatPercent(value: number): string;
export declare function box(title: string, content: string): string;
export declare function table(headers: string[], rows: string[][]): string;
export declare function spinner(text: string): Ora;
export declare function logo(): string;
export declare function helpFooter(): string;
export declare function formatMessage(type: string, agentName: string | null, content: string, timestamp?: Date): string;
export declare function progressBar(current: number, total: number, width?: number): string;
//# sourceMappingURL=display.d.ts.map