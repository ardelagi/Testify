const { Events, ActivityType } = require("discord.js");
const FiveMAPI = require("../../api/fivemApi");

const SERVER_DOMAIN = "main.motionliferp.com:30120"; // server domain

module.exports = {
    name: Events.ClientReady,
    async execute(client) {
        client.logs.info(`[RPC_STATUS] Setting rotating server info...`);

        const updatePresence = async () => {
            try {
                const data = await FiveMAPI.fetchServer(SERVER_DOMAIN);

                let activities = [];

                if (data) {
                    const players = data.players || [];
                    const playerCount = data.clients || 0;
                    const maxPlayers = data.sv_maxclients || 0;

                    // Ping range
                    let pingLow = "N/A";
                    let pingHigh = "N/A";
                    if (players.length > 0) {
                        const pings = players.map(p => p.ping).filter(p => typeof p === "number");
                        if (pings.length > 0) {
                            pingLow = Math.min(...pings);
                            pingHigh = Math.max(...pings);
                        }
                    }

                    // Top 2 player
                    const topPlayers = players.slice(0, 2).map(p => p.name);

                    activities = [
                        { type: ActivityType.Watching, name: `Players: ${playerCount}/${maxPlayers}` },
                        { type: ActivityType.Watching, name: `Ping: ${pingLow}-${pingHigh} ms` },
                        { type: ActivityType.Watching, name: `Top: ${topPlayers.join(", ") || "None"}` },
                        { type: ActivityType.Playing, name: `${data.hostname || "Unknown Server"}` },
                    ];
                } else {
                    // fallback jika fetch gagal
                    activities = [
                        { type: ActivityType.Watching, name: `Server Offline` },
                    ];
                }

                const status = activities[Math.floor(Math.random() * activities.length)];
                await client.user.setPresence({
                    activities: [{ name: status.name, type: status.type }],
                });
            } catch (err) {
                console.error(`[RPC_STATUS] Error updating presence:`, err);
            }
        };

        // update pertama langsung
        await updatePresence();

        // update setiap 10 detik
        setInterval(updatePresence, 10_000);

        client.logs.success(`[RPC_STATUS] Rotating server info loaded successfully.`);
    },
};