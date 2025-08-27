const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.serverDomain = "main.motionliferp.com"; // pakai domain langsung
        this.rateLimiter = {
            lastCalls: {},
            minInterval: 15_000, // minimal jeda 15 detik antar fetch per server
        };
        this.cache = {}; // cache hasil fetch
    }

    canCall(serverId) {
        const now = Date.now();
        const last = this.rateLimiter.lastCalls[serverId] || 0;
        if (now - last < this.rateLimiter.minInterval) {
            return false;
        }
        this.rateLimiter.lastCalls[serverId] = now;
        return true;
    }

    async fetchServer(serverId) {
        if (!this.canCall(serverId) && this.cache[serverId]) {
            return this.cache[serverId];
        }

        try {
            const url = `http://${serverId}:30120/dynamic.json`;
            const response = await fetch(url, { timeout: 5000 });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            // fetch players
            let players = [];
            try {
                const pResp = await fetch(`http://${serverId}:30120/players.json`, { timeout: 5000 });
                if (pResp.ok) players = await pResp.json();
            } catch {}

            const serverData = {
                hostname: data.hostname || "Unknown",
                maxPlayers: parseInt(data.sv_maxclients) || 0,
                clients: data.clients || 0,
                playersList: players || [],
                resources: data.resources || [],
                vars: data.vars || {},
                ping: data.ping || 0,
            };

            this.cache[serverId] = serverData;
            return serverData;

        } catch (err) {
            console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Direct connect fetch error: ${err.message}${color.reset}`);
            return this.cache[serverId] || null;
        }
    }

    async getAll(serverId) {
        return await this.fetchServer(serverId);
    }

    async getPlayers(serverId) {
        const data = await this.fetchServer(serverId);
        return data?.playersList || [];
    }

    async getBasicInfo(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return null;
        return {
            hostname: data.hostname,
            maxPlayers: data.maxPlayers,
            players: data.clients,
            ip: serverId,
        };
    }
}

module.exports = new FiveMAPI();