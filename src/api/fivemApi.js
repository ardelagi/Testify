const fetch = require("node-fetch");
const { color, getTimestamp } = require("../utils/loggingEffects");

class FiveMAPI {
    constructor() {
        this.serverDomain = "main.motionliferp.com";
        this.config = {
            fetchInterval: 30_000, // fetch setiap 30 detik
            cacheExpiry: 45_000,   // cache expire 45 detik
            timeout: 8_000,        // timeout 8 detik
        };
        
        this.cache = new Map();
        this.fetchTimer = null;
        this.isInitialized = false;
    }

    // Initialize auto-fetching system
    initialize(serverId) {
        if (this.isInitialized) return;
        
        console.log(`${color.green}[${getTimestamp()}] [FIVEM_API] Initializing smart caching for ${serverId}${color.reset}`);
        
        // Fetch immediately
        this._fetchAndCache(serverId);
        
        // Set up interval fetching
        this.fetchTimer = setInterval(() => {
            this._fetchAndCache(serverId);
        }, this.config.fetchInterval);
        
        this.isInitialized = true;
    }

    // Internal method untuk fetch dan cache
    async _fetchAndCache(serverId) {
        try {
            console.log(`${color.blue}[${getTimestamp()}] [FIVEM_API] Fetching fresh data from ${serverId}${color.reset}`);
            
            const [dynamicData, playersData] = await Promise.allSettled([
                fetch(`http://${serverId}:30120/dynamic.json`, { 
                    timeout: this.config.timeout 
                }).then(res => res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)),
                
                fetch(`http://${serverId}:30120/players.json`, { 
                    timeout: this.config.timeout 
                }).then(res => res.ok ? res.json() : [])
            ]);

            const data = dynamicData.status === 'fulfilled' ? dynamicData.value : {};
            const players = playersData.status === 'fulfilled' ? playersData.value : [];

            const serverData = {
                hostname: data.hostname || "Motion Life RP",
                maxPlayers: parseInt(data.sv_maxclients) || 128,
                clients: data.clients || 0,
                playersList: Array.isArray(players) ? players : [],
                resources: data.resources || [],
                vars: data.vars || {},
                ping: data.ping || 0,
                lastUpdate: Date.now(),
                status: 'online'
            };

            this.cache.set(serverId, serverData);
            console.log(`${color.green}[${getTimestamp()}] [FIVEM_API] ✓ Cached data: ${serverData.clients}/${serverData.maxPlayers} players${color.reset}`);
            
            return serverData;

        } catch (err) {
            console.warn(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Fetch error: ${err.message}${color.reset}`);
            
            // Set offline status jika error
            const offlineData = {
                hostname: "Motion Life RP [OFFLINE]",
                maxPlayers: 128,
                clients: 0,
                playersList: [],
                resources: [],
                vars: {},
                ping: 999,
                lastUpdate: Date.now(),
                status: 'offline'
            };
            
            this.cache.set(serverId, offlineData);
            return offlineData;
        }
    }

    // Get data from cache (always fast)
    getFromCache(serverId) {
        const cached = this.cache.get(serverId);
        
        if (!cached) {
            // Return default data jika belum ada cache
            return {
                hostname: "Motion Life RP [LOADING...]",
                maxPlayers: 128,
                clients: 0,
                playersList: [],
                resources: [],
                vars: {},
                ping: 0,
                lastUpdate: Date.now(),
                status: 'loading'
            };
        }

        // Check if cache expired
        const isExpired = (Date.now() - cached.lastUpdate) > this.config.cacheExpiry;
        if (isExpired && cached.status !== 'offline') {
            // Trigger background refresh
            this._fetchAndCache(serverId).catch(() => {});
        }

        return cached;
    }

    // Public methods - semua menggunakan cache
    async getAll(serverId) {
        if (!this.isInitialized) this.initialize(serverId);
        return this.getFromCache(serverId);
    }

    async getPlayers(serverId) {
        const data = this.getFromCache(serverId);
        return data.playersList || [];
    }

    async getBasicInfo(serverId) {
        const data = this.getFromCache(serverId);
        return {
            hostname: data.hostname,
            maxPlayers: data.maxPlayers,
            players: data.clients,
            ip: serverId,
            status: data.status,
            lastUpdate: data.lastUpdate
        };
    }

    // Method untuk get real-time stats (untuk RPC)
    getQuickStats(serverId) {
        const data = this.getFromCache(serverId);
        const players = data.playersList || [];
        
        // Calculate ping stats
        let pingStats = { min: "N/A", max: "N/A", avg: "N/A" };
        if (players.length > 0) {
            const pings = players.map(p => p.ping).filter(p => typeof p === "number" && p > 0);
            if (pings.length > 0) {
                pingStats.min = Math.min(...pings);
                pingStats.max = Math.max(...pings);
                pingStats.avg = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
            }
        }

        // Top players
        const topPlayers = players
            .slice(0, 3)
            .map(p => p.name || "Unknown")
            .filter(name => name.length > 0);

        return {
            hostname: data.hostname,
            playerCount: data.clients,
            maxPlayers: data.maxPlayers,
            ping: pingStats,
            topPlayers: topPlayers.length > 0 ? topPlayers : ["None"],
            resources: data.resources.length,
            status: data.status,
            uptime: Math.floor((Date.now() - data.lastUpdate) / 1000)
        };
    }

    // Cleanup method
    destroy() {
        if (this.fetchTimer) {
            clearInterval(this.fetchTimer);
            this.fetchTimer = null;
        }
        this.cache.clear();
        this.isInitialized = false;
        console.log(`${color.yellow}[${getTimestamp()}] [FIVEM_API] Cache cleared and timers stopped${color.reset}`);
    }
}

module.exports = new FiveMAPI();