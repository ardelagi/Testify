const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.serverDomain = "main.motionliferp.com:30120"; // direct connect domain
        this.rateLimiter = {
            lastCalls: {},
            minInterval: 5000, 
        };
    }

    canCall(serverId) {
        const now = Date.now();
        const last = this.rateLimiter.lastCalls[serverId] || 0;
        if (now - last < this.rateLimiter.minInterval) {
            console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Rate limited: ${serverId}${color.reset}`);
            return false;
        }
        this.rateLimiter.lastCalls[serverId] = now;
        return true;
    }

    async fetchServer(serverId) {
        if (!this.canCall(serverId)) return null;

        try {
            const dynamicRes = await fetch(`http://${this.serverDomain}/dynamic.json`);
            const playersRes = await fetch(`http://${this.serverDomain}/players.json`);

            const dynamicData = dynamicRes.ok ? await dynamicRes.json() : {};
            const playersData = playersRes.ok ? await playersRes.json() : [];

            return {
                hostname: dynamicData.hostname || "Unknown",
                maxPlayers: parseInt(dynamicData.sv_maxclients || 0, 10),
                clients: parseInt(dynamicData.clients || playersData.length, 10),
                players: playersData.map(p => ({
                    id: p.id,
                    name: p.name,
                    ping: p.ping
                })),
                resources: [], 
                vars: {}, 
            };
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Direct connect fetch error: ${err.message}${color.reset}`);
            return null;
        }
    }

    async getBasicInfo(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return null;
        return {
            hostname: data.hostname,
            maxPlayers: data.maxPlayers,
            players: data.clients,
        };
    }

    async getPlayers(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return [];
        return data.players; 
    }

    async getResources(serverId, limit = 50) {
        return [];
    }

    async getVariables(serverId) {
        return {};
    }

    async getPerformance(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return {};
        return {
            onlinePlayers: data.clients,
            maxPlayers: data.maxPlayers
        };
    }

    async getAll(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return null;
        return {
            hostname: data.hostname,
            maxPlayers: data.maxPlayers,
            players: data.clients,
            playersList: data.players,
            resources: [],
            vars: {},
            performance: {
                onlinePlayers: data.clients,
                maxPlayers: data.maxPlayers
            }
        };
    }
}

module.exports = new FiveMAPI();