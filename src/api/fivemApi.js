const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.baseUrl = "https://servers-frontend.fivem.net/api/servers/single";
        this.cache = {}; // cache per serverId
        this.cacheTTL = 5000; // 5 detik
    }

    async fetchServer(serverId) {
        const now = Date.now();

        // kalau masih ada di cache, gunakan itu
        if (this.cache[serverId] && (now - this.cache[serverId].timestamp < this.cacheTTL)) {
            return this.cache[serverId].data;
        }

        const url = `${this.baseUrl}/${serverId}`;
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "DiscordBot/1.0 (contact: youremail@domain.com)"
                }
            });

            if (!response.ok) {
                console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] HTTP ${response.status}${color.reset}`);
                return null;
            }

            const data = await response.json();
            this.cache[serverId] = { data: data?.Data || null, timestamp: now };
            return this.cache[serverId].data;

        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Fetch error: ${err.message}${color.reset}`);
            return null;
        }
    }

    async getAll(serverId) {
        return await this.fetchServer(serverId);
    }

    async getBasicInfo(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return null;
        return {
            hostname: data.hostname,
            description: data.vars?.sv_projectDesc || "No description",
            ip: data.connectEndPoints ? data.connectEndPoints[0] : null,
            maxPlayers: data.sv_maxclients,
            players: data.clients,
        };
    }

    async getPlayers(serverId, limit = 30) {
        const data = await this.fetchServer(serverId);
        if (!data) return [];
        return data.players.slice(0, limit).map(p => ({
            id: p.id,
            name: p.name,
            ping: p.ping
        }));
    }

    async getResources(serverId, limit = 50) {
        const data = await this.fetchServer(serverId);
        if (!data) return [];
        return data.resources ? data.resources.slice(0, limit) : [];
    }

    async getVariables(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return {};
        return data.vars || {};
    }

    async getPerformance(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return {};
        return {
            upvotePower: data.upvotePower,
            ownerID: data.ownerID,
            fallback: data.fallback,
            enhancedHostSupport: data.enhancedHostSupport,
            supportStatus: data.support_status,
            lastSeen: data.lastSeen,
        };
    }
}

module.exports = new FiveMAPI();