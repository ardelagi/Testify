const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.serverDomain = "main.motionliferp.com:30120"; // domain server FiveM
        this.baseUrl = `http://${this.serverDomain}`;
        this.rateLimiter = {
            lastCalls: {},
            minInterval: 10_000, // minimal jeda 10 detik antar call
        };
    }

    canCall(key) {
        const now = Date.now();
        const last = this.rateLimiter.lastCalls[key] || 0;
        if (now - last < this.rateLimiter.minInterval) {
            console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Rate limited: ${key}${color.reset}`);
            return false;
        }
        this.rateLimiter.lastCalls[key] = now;
        return true;
    }

    async fetchJSON(endpoint) {
        if (!this.canCall(endpoint)) return null;
        try {
            const res = await fetch(`${this.baseUrl}/${endpoint}`, { timeout: 5000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Direct connect fetch error: request to ${this.baseUrl}/${endpoint} failed, reason: ${err.message}${color.reset}`);
            return null;
        }
    }

    async fetchServer() {
        // Ambil dynamic.json dulu
        const dynamicData = await this.fetchJSON("dynamic.json");
        if (!dynamicData) return null;

        // Ambil players.json, fallback ke array kosong jika gagal
        const playersData = await this.fetchJSON("players.json") || [];

        return {
            hostname: dynamicData.hostname || "Unknown",
            sv_maxclients: Number(dynamicData.sv_maxclients) || 0,
            clients: Number(dynamicData.clients) || 0,
            players: playersData.map(p => ({
                id: p.id,
                name: p.name,
                ping: p.ping,
            })),
            resources: [], // optional, bisa diisi manual kalau server expose
            vars: dynamicData.vars || {},
            lastSeen: Date.now(),
            connectEndPoints: [`${this.serverDomain}`],
        };
    }

    async getBasicInfo() {
        const data = await this.fetchServer();
        if (!data) return null;
        return {
            hostname: data.hostname,
            ip: data.connectEndPoints[0],
            maxPlayers: data.sv_maxclients,
            players: data.clients,
        };
    }

    async getPlayers() {
        const data = await this.fetchServer();
        if (!data) return [];
        return data.players;
    }

    async getResources() {
        const data = await this.fetchServer();
        if (!data) return [];
        return data.resources;
    }

    async getVariables() {
        const data = await this.fetchServer();
        if (!data) return {};
        return data.vars;
    }

    async getAll() {
        return await this.fetchServer();
    }
}

module.exports = new FiveMAPI();