const { Events, ActivityType } = require("discord.js");
const FiveMAPI = require("../../api/fivemApi");

module.exports = {
    name: Events.ClientReady,
    async execute(client) {
        client.logs.info(`[RPC_STATUS] Starting rotating FiveM server info presence...`);

        const updatePresence = async () => {
            const data = await FiveMAPI.getAll();
            if (!data) {
                client.user.setPresence({
                    activities: [{ name: "Server Offline", type: ActivityType.Watching }]
                });
                return;
            }

            const players = data.players || [];

            const pings = players.map(p => p.ping).filter(p => typeof p === "number");
            const pingMin = pings.length ? Math.min(...pings) : "N/A";
            const pingMax = pings.length ? Math.max(...pings) : "N/A";

            const topPlayers = players
                .sort((a, b) => a.ping - b.ping)
                .slice(0, 2)
                .map(p => p.name);

            const activities = [
                { type: "Watching", name: `${data.clients}/${data.maxPlayers} on ${data.hostname}` },
                { type: "Watching", name: `Ping: ${pingMin}-${pingMax} ms` },
                { type: "Watching", name: topPlayers.length ? `Top Players: ${topPlayers.join(", ")}` : "No players online" }
            ];

            const status = activities[Math.floor(Math.random() * activities.length)];

            client.user.setPresence({
                activities: [{ name: status.name, type: status.type }]
            });
        };

        await updatePresence();
        setInterval(updatePresence, 5_000);

        client.logs.success(`[RPC_STATUS] Rotating FiveM server info presence loaded.`);
    }
};