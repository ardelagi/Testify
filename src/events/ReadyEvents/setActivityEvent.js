const { Events, ActivityType } = require('discord.js');
const FiveMAPI = require('../../api/fivemApi');

const SERVER_DOMAIN = "main.motionliferp.com";

module.exports = {
    name: Events.ClientReady,
    async execute(client) {
        client.logs.info(`[RPC_STATUS] Setting up optimized FiveM presence rotation...`);

        let currentActivityIndex = 0;
        let lastServerStatus = 'loading';

        const updatePresence = async () => {
            try {
                // Get data dari cache (selalu cepat)
                const stats = FiveMAPI.getQuickStats(SERVER_DOMAIN);
                
                // Buat activities berdasarkan status server
                let activities = [];
                
                if (stats.status === 'offline') {
                    activities = [
                        { type: ActivityType.Watching, name: `🔴 ${stats.hostname}` },
                        { type: ActivityType.Watching, name: `🔴 Server Offline` },
                        { type: ActivityType.Watching, name: `🔴 Try again later` },
                    ];
                } else if (stats.status === 'maintenance') {
                    activities = [
                        { type: ActivityType.Watching, name: `🟡 ${stats.hostname}` },
                        { type: ActivityType.Watching, name: `🟡 Low Population (${stats.playerCount}/10+)` },
                        { type: ActivityType.Watching, name: `🟡 Maintenance/Testing` },
                    ];
                } else if (stats.status === 'loading') {
                    activities = [
                        { type: ActivityType.Watching, name: `⏳ Loading server data...` },
                        { type: ActivityType.Watching, name: `⏳ Connecting to server...` },
                    ];
                } else {
                    // Server online - activities lengkap
                    const playerInfo = `${stats.playerCount}/${stats.maxPlayers} players`;
                    
                    // Format ping info (min-max | avg)
                    let pingInfo = "No ping data";
                    if (stats.ping.min !== "N/A") {
                        pingInfo = `Ping: low ${stats.ping.min} | high ${stats.ping.max}ms | avg ${stats.ping.avg}ms`;
                    }
                    
                    const topPlayersText = stats.topPlayers.length > 0 ? stats.topPlayers.join(", ") : "Waiting for players";
                    
                    activities = [
                        { type: ActivityType.Playing, name: `${playerInfo} on Motionlife Roleplay` },
                        { type: ActivityType.Watching, name: `${pingInfo}` },
                        { type: ActivityType.Watching, name: `Top 3 ${topPlayersText}` },
                    ];
                }

                // Rotate activities
                if (activities.length > 0) {
                    const activity = activities[currentActivityIndex % activities.length];
                    
                    await client.user.setPresence({
                        activities: [activity],
                        status: stats.status === 'offline' ? 'dnd' : 
                               stats.status === 'maintenance' ? 'idle' : 'online'
                    });

                    currentActivityIndex++;
                    
                    // Log perubahan status
                    if (lastServerStatus !== stats.status) {
                        client.logs.info(`[RPC_STATUS] Server status changed: ${lastServerStatus} → ${stats.status}`);
                        lastServerStatus = stats.status;
                    }
                }

            } catch (err) {
                client.logs.error(`[RPC_STATUS] Error updating presence: ${err.message}`);
                
                // Fallback presence
                await client.user.setPresence({
                    activities: [{ 
                        name: `❌ Status update failed`, 
                        type: ActivityType.Watching 
                    }],
                    status: 'idle'
                });
            }
        };

        // Initialize FiveM API
        await FiveMAPI.getAll(SERVER_DOMAIN);

        // Update presence setiap 15 detik (lebih lambat dari fetch cycle)
        updatePresence();
        const presenceInterval = setInterval(updatePresence, 5_000);

        // Cleanup saat bot shutdown
        process.on('SIGINT', () => {
            clearInterval(presenceInterval);
            FiveMAPI.destroy();
            client.logs.info(`[RPC_STATUS] Presence updates stopped`);
        });
    }
};