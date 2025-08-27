const { Events, ActivityType } = require('discord.js');
const FiveMAPI = require('../../api/fivemApi');

const SERVER_DOMAIN = "main.motionliferp.com";

module.exports = {
    name: Events.ClientReady,
    async execute(client) {

        client.logs.info(`[RPC_STATUS] Setting rotating FiveM server info presence...`);

        const updatePresence = async () => {
            try {
                const data = await FiveMAPI.getAll(SERVER_DOMAIN);
                if (!data) {
                    client.user.setPresence({ activities: [{ name: `Server info unavailable`, type: ActivityType.Watching }] });
                    return;
                }

                const players = data.playersList || [];
                const playerCount = players.length;
                const maxPlayers = data.maxPlayers || 0;

                // ping terendah & tertinggi
                let minPing = "N/A", maxPing = "N/A";
                if (players.length > 0) {
                    const pings = players.map(p => p.ping).filter(p => typeof p === "number");
                    minPing = Math.min(...pings);
                    maxPing = Math.max(...pings);
                }

                // top 2 player online
                const topPlayers = players.slice(0, 2).map(p => p.name) || ["None"];

                const activities = [
                    { type: 'Watching', name: `Server: ${data.hostname}` },
                    { type: 'Watching', name: `Players: ${playerCount}/${maxPlayers}` },
                    { type: 'Watching', name: `Ping: ${minPing}-${maxPing}ms` },
                    { type: 'Watching', name: `Resources: ${data.resources.length}` },
                    { type: 'Watching', name: `Top: ${topPlayers.join(", ")}` },
                ];

                const status = activities[Math.floor(Math.random() * activities.length)];
                client.user.setPresence({ activities: [{ name: status.name, type: status.type }] });

            } catch (err) {
                client.logs.error(`[RPC_STATUS] Error updating presence: ${err.message}`);
            }
        };

        // update tiap 10 detik
        updatePresence();
        setInterval(updatePresence, 10_000);

        client.logs.success(`[RPC_STATUS] FiveM server presence loaded successfully.`);
    }
};