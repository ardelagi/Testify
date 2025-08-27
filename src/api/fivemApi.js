const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.serverUrl = "http://main.motionliferp.com:30120";
        this.rateLimiter = {
            lastCall: 0,
            minInterval: 8000, 
        };
    }

    canCall() {
        const now = Date.now();
        if (now - this.rateLimiter.lastCall < this.rateLimiter.minInterval) {
            console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Rate limited${color.reset}`);
            return false;
        }
        this.rateLimiter.lastCall = now;
        return true;
    }

    async fetchDynamic() {
        if (!this.canCall()) return null;
        try {
            const res = await fetch(`${this.serverUrl}/dynamic.json`, { timeout: 5000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Direct connect fetch error: ${err.message}${color.reset}`);
            return null;
        }
    }

    async fetchPlayers() {
        if (!this.canCall()) return [];
        try {
            const res = await fetch(`${this.serverUrl}/players.json`, { timeout: 5000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Direct connect fetch error: ${err.message}${color.reset}`);
            return [];
        }
    }

    async getAll() {
        const dynamic = await this.fetchDynamic();
        const players = await this.fetchPlayers();

        return {
            hostname: dynamic?.hostname || "Unknown Server",
            clients: dynamic?.clients || 0,
            sv_maxclients: dynamic?.sv_maxclients || 0,
            resources: dynamic?.resources || [],
            players: players || [],
        };
    }
}

module.exports = new FiveMAPI();