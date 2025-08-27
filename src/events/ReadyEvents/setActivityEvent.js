const { Events, ActivityType } = require("discord.js");
const FiveMAPI = require("../../api/fivemApi");

module.exports = {
    name: Events.ClientReady,
    async execute(client) {
        client.logs.info(`[RPC_STATUS] Setting rotating FiveM server info...`);

        const updatePresence = async () => {
            try {
                const data = await FiveMAPI.getAll();
                if (!data) return;

                const players = data.players || [];

                // Ping min & max
                const pings = players.map(p => p.ping).sort((a, b) => a - b);
                const minPing = pings[0] ?? 0;
                const maxPing = pings[pings.length - 1] ?? 0;

                // Top 2 player
                const topPlayers = players.slice(0, 2).map(p => `${p.name} (${p.ping}ms)`).join(", ") || "No players online";

                const activities = [
                    { type: "Watching", name: `${data.hostname} | ${players.length}/${data.sv_maxclients} players` },
                    { type: "Watching", name: `Ping: ${minPing}ms - ${maxPing}ms` },
                    { type: "Watching", name: `Top 2: ${topPlayers}` },
                    { type: "Playing", name: `${client.config.prefix}help | @${client.user.username}` },
                ];

                const status = activities[Math.floor(Math.random() * activities.length)];

                client.user.setPresence({
                    activities: [{ name: status.name, type: ActivityType[status.type] }],
                });
            } catch (err) {
                client.logs.error(`[RPC_STATUS] Error updating presence: ${err.message}`);
            }
        };

        // Update pertama langsung
        await updatePresence();

        // Update tiap 10 detik
        setInterval(updatePresence, 5_000);

        client.logs.success(`[RPC_STATUS] Rotating FiveM server info loaded successfully.`);
    },
};