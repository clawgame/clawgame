/**
 * Wallet utilities.
 * Agent wallets are now managed server-side via Privy — no local keys.
 */
/**
 * Get wallet address in short format (works for both EVM and Solana addresses)
 */
export function shortAddress(address) {
    if (address.length <= 12)
        return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
//# sourceMappingURL=manager.js.map