const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.serverDomain = "main.motionliferp.com:30120";
        this.cache = null;
        this.cacheTime = 0;
        this.cacheDuration = 30 * 1000; // cache 30 detik
        this.rateLimiter = {
            lastCall: 0,
            minInterval: 5000, // minimal jeda 5 detik antar fetch
        };
    }

    canCall() {
        const now = Date.now();
        if (now - this.rateLimiter.lastCall < this.rateLimiter.minInterval) {
            return false;
        }
        this.rateLimiter.lastCall = now;
        return true;
    }

    async fetchDirect() {
        try {
            const now = Date.now();
            if (this.cache && now - this.cacheTime < this.cacheDuration) {
                return this.cache;
            }

            if (!this.canCall()) return this.cache;

            // ambil dynamic.json
            const dynamicRes = await fetch(`http://${this.serverDomain}/dynamic.json`, { timeout: 5000 });
            const dynamic = await dynamicRes.json();

            // ambil players.json
            const playersRes = await fetch(`http://${this.serverDomain}/players.json`, { timeout: 5000 });
            const players = await playersRes.json();

            const data = {
                hostname: dynamic.hostname || "Unknown",
                maxPlayers: parseInt(dynamic.sv_maxclients) || 0,
                clients: dynamic.clients || 0,
                players: players || [],
            };

            this.cache = data;
            this.cacheTime = Date.now();
            return data;
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Direct connect fetch error: ${err.message}${color.reset}`);
            return this.cache; // fallback ke cache
        }
    }

    async getAll() {
        return await this.fetchDirect();
    }
}

module.exports = new FiveMAPI();