const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.baseUrl = "https://servers-frontend.fivem.net/api/servers/single";
        this.streamUrl = "https://servers-frontend.fivem.net/api/servers/stream/";
        this.joinUrl = "https://api.cfx.re/join"; // fallback terakhir
        this.rateLimiter = {
            lastCalls: {},
            minInterval: 5000, // minimal jeda 5 detik antar call
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
        const url = `${this.baseUrl}/${serverId}`;

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json, text/plain, */*",
                },
            });

            if (response.status === 403) {
                console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] 403 on single/${serverId}, trying stream...${color.reset}`);
                return await this.fetchFromStream(serverId);
            }

            if (!response.ok) {
                console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] HTTP ${response.status}${color.reset}`);
                return null;
            }

            const data = await response.json();
            return data?.Data || null;
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Fetch error: ${err.message}${color.reset}`);
            return null;
        }
    }

    async fetchFromStream(serverId) {
        try {
            const response = await fetch(this.streamUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json, text/plain, */*",
                },
            });

            if (response.status === 403) {
                console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Stream also 403, trying join/${serverId}...${color.reset}`);
                return await this.fetchFromJoin(serverId);
            }

            if (!response.ok) {
                console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Stream HTTP ${response.status}${color.reset}`);
                return null;
            }

            const servers = await response.json();
            const match = servers.find(s => s.Data?.server === serverId);
            if (!match) {
                console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Server ${serverId} not found in stream${color.reset}`);
                return null;
            }

            console.log(`${color.green}[${getTimestamp()}] [FIVEM_API] Found server ${serverId} via stream${color.reset}`);
            return match.Data;
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Stream fetch error: ${err.message}${color.reset}`);
            return null;
        }
    }

    async fetchFromJoin(serverId) {
        try {
            const response = await fetch(`${this.joinUrl}/${serverId}`, {
                headers: { "User-Agent": "Mozilla/5.0" },
            });

            if (!response.ok) {
                console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Join HTTP ${response.status}${color.reset}`);
                return null;
            }

            const data = await response.json();
            console.log(`${color.green}[${getTimestamp()}] [FIVEM_API] Found server ${serverId} via cfx.re/join${color.reset}`);
            
            // adaptasi supaya mirip structure Data
            return {
                hostname: data.Data?.hostname || "Unknown",
                connectEndPoints: [data.EndPoint],
                sv_maxclients: data.Data?.sv_maxclients || 0,
                clients: data.Data?.clients || 0,
                vars: data.Data?.vars || {},
                players: data.Data?.players || [],
                resources: data.Data?.resources || [],
            };
        } catch (err) {
            console.error(`${color.red}[${getTimestamp()}] [FIVEM_API] Join fetch error: ${err.message}${color.reset}`);
            return null;
        }
    }

    // 📌 Info dasar
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

    // 📌 Player list
    async getPlayers(serverId, limit = 30) {
        const data = await this.fetchServer(serverId);
        if (!data) return [];
        return data.players.slice(0, limit).map((p) => ({
            id: p.id,
            name: p.name,
            ping: p.ping,
        }));
    }

    // 📌 Resource list
    async getResources(serverId, limit = 50) {
        const data = await this.fetchServer(serverId);
        if (!data) return [];
        return data.resources ? data.resources.slice(0, limit) : [];
    }

    // 📌 Vars (custom variable dari server.cfg)
    async getVariables(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return {};
        return data.vars || {};
    }

    // 📌 Performance (ping, up time, dll)
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

    // 📌 Gabung semua data jadi satu
    async getAll(serverId) {
        const data = await this.fetchServer(serverId);
        if (!data) return null;

        return {
            hostname: data.hostname,
            description: data.vars?.sv_projectDesc || "No description",
            ip: data.connectEndPoints ? data.connectEndPoints[0] : null,
            maxPlayers: data.sv_maxclients,
            players: data.clients,
            resources: data.resources || [],
            vars: data.vars || {},
            performance: {
                upvotePower: data.upvotePower,
                ownerID: data.ownerID,
                fallback: data.fallback,
                enhancedHostSupport: data.enhancedHostSupport,
                supportStatus: data.support_status,
                lastSeen: data.lastSeen,
            },
            playersList: data.players || [],
        };
    }
}

module.exports = new FiveMAPI();