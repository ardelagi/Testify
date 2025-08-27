const { Events, ActivityType } = require('discord.js');
const FiveMAPI = require('../../api/fivemApi');

const SERVER_ID = "main.motionliferp.com:30120";

module.exports = {
    name: Events.ClientReady,
    async execute(client) {
        client.logs.info(`[RPC_STATUS] Setting rotating FiveM server info status...`);

        const updateStatus = async () => {
            try {
                const data = await FiveMAPI.getAll(SERVER_ID);
                if (!data) return;

                const players = data.playersList || [];
                const onlineCount = players.length;
                const maxPlayers = data.maxPlayers || 0;
                const serverName = data.hostname || "Unknown Server";

                const topPlayers = players.slice(0, 5).map(p => p.name).join(", ") || "No players online";

                const activities = [
                    { type: ActivityType.Watching, name: `${onlineCount}/${maxPlayers} players on ${serverName}` },
                    { type: ActivityType.Watching, name: `Server: ${serverName}` },
                    { type: ActivityType.Watching, name: `Players online: ${onlineCount}` },
                    { type: ActivityType.Watching, name: `Top 5: ${topPlayers}` },
                ];

                const status = activities[Math.floor(Math.random() * activities.length)];

                await client.user.setPresence({ activities: [{ name: status.name, type: status.type }] });

            } catch (err) {
                client.logs.error(`[RPC_STATUS] Failed to update status: ${err.message}`);
            }
        };

        await updateStatus();
        setInterval(updateStatus, 5_000);

        client.logs.success(`[RPC_STATUS] Rotating FiveM server info status loaded successfully.`);
    }
};