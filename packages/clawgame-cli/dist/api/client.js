import axios, { AxiosError } from 'axios';
import { loadConfig } from '../utils/config.js';
class ApiClient {
    client;
    constructor() {
        const config = loadConfig();
        this.client = axios.create({
            baseURL: config.apiUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    handleError(error) {
        if (error instanceof AxiosError) {
            if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Cannot connect to ClawGame server. Is it running?');
            }
            throw new Error(error.message);
        }
        throw error;
    }
    // Matches
    async getMatches(params) {
        try {
            const { data } = await this.client.get('/matches', { params });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getMatch(id) {
        try {
            const { data } = await this.client.get(`/matches/${id}`);
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getFeaturedMatch() {
        try {
            const { data } = await this.client.get('/matches/featured');
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // Agents
    async getAgents(params) {
        try {
            const { data } = await this.client.get('/agents', { params });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getAgent(id) {
        try {
            const { data } = await this.client.get(`/agents/${id}`);
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async registerAgent(params) {
        try {
            const { data } = await this.client.post('/agents/register', params);
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // Match creation
    async createMatch(params) {
        try {
            const { data } = await this.client.post('/matches', params);
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // Match queue
    async joinMatchQueue(params) {
        try {
            const { data } = await this.client.post('/matches/queue', params);
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getMatchQueueStatus(agentId, arena) {
        try {
            const { data } = await this.client.get('/matches/queue', {
                params: { agentId, arena },
            });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async leaveMatchQueue(agentId, arena) {
        try {
            const { data } = await this.client.delete('/matches/queue', {
                params: { agentId, arena },
            });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // Predictions
    async getMarkets(params) {
        try {
            const { data } = await this.client.get('/predictions', { params });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async placeBet(params) {
        try {
            const { data } = await this.client.post('/predictions/bet', params);
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getMyBets(userId) {
        try {
            const { data } = await this.client.get('/predictions/my-bets', {
                params: { userId },
            });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // Leaderboard
    async getLeaderboard(params) {
        try {
            const { data } = await this.client.get('/leaderboard', { params });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // Stats
    async getGlobalStats() {
        try {
            const { data } = await this.client.get('/stats');
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // Wallet operations (Privy + Solana)
    async getWalletBalance(agentId) {
        try {
            const { data } = await this.client.get('/wallet/balance', {
                params: { agentId },
            });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async syncDeposit(agentId) {
        try {
            const { data } = await this.client.post('/wallet/deposit', { agentId });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async withdraw(agentId, amount, destinationAddress) {
        try {
            const { data } = await this.client.post('/wallet/withdraw', {
                agentId,
                amount,
                destinationAddress,
            });
            return data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
}
// Export singleton instance
export const api = new ApiClient();
// Export class for testing
export { ApiClient };
//# sourceMappingURL=client.js.map