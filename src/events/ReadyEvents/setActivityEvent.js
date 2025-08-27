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
                        { type: ActivityType.Watching, name: `🔴 Maintenance Mode` },
                    ];
                } else if (stats.status === 'loading') {
                    activities = [
                        { type: ActivityType.Watching, name: `🟡 Loading server data...` },
                        { type: ActivityType.Watching, name: `🟡 Connecting to server...` },
                    ];
                } else {
                    // Server online - activities lengkap
                    const playerInfo = `${stats.playerCount}/${stats.maxPlayers} players`;
                    const pingInfo = stats.ping.avg !== "N/A" ? `${stats.ping.avg}ms avg` : "No ping data";
                    const topPlayersText = stats.topPlayers.length > 0 ? stats.topPlayers.slice(0, 2).join(", ") : "No players";
                    
                    activities = [
                        { type: ActivityType.Watching, name: `🟢 ${stats.hostname}` },
                        { type: ActivityType.Playing, name: `with ${playerInfo}` },
                        { type: ActivityType.Watching, name: `📊 ${pingInfo} ping` },
                        { type: ActivityType.Watching, name: `📦 ${stats.resources} resources` },
                        { type: ActivityType.Watching, name: `👥 ${topPlayersText}` },
                        { type: ActivityType.Listening, name: `to ${stats.playerCount} voices` },
                    ];

                    // Tambah aktivitas khusus berdasarkan kondisi
                    if (stats.playerCount === 0) {
                        activities.push({ type: ActivityType.Watching, name: `🌙 Server is quiet...` });
                    } else if (stats.playerCount >= stats.maxPlayers * 0.8) {
                        activities.push({ type: ActivityType.Watching, name: `🔥 Server is busy!` });
                    } else if (stats.playerCount >= stats.maxPlayers * 0.5) {
                        activities.push({ type: ActivityType.Watching, name: `⚡ Join the action!` });
                    }
                }

                // Rotate activities
                if (activities.length > 0) {
                    const activity = activities[currentActivityIndex % activities.length];
                    
                    await client.user.setPresence({
                        activities: [activity],
                        status: stats.status === 'offline' ? 'dnd' : 'online'
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

        await FiveMAPI.getAll(SERVER_DOMAIN);

        updatePresence();
        const presenceInterval = setInterval(updatePresence, 5_000);

        // Cleanup saat bot shutdown
        process.on('SIGINT', () => {
            clearInterval(presenceInterval);
            FiveMAPI.destroy();
            client.logs.info(`[RPC_STATUS] Presence updates stopped`);
        });

        client.logs.success(`[RPC_STATUS] ✓ FiveM presence loaded with smart caching!`);
        client.logs.info(`[RPC_STATUS] Rotation: Every 15s | Data refresh: Every 30s`);
    }
};