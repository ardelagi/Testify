const { Events, ActivityType } = require('discord.js');
const FiveMAPI = require("../../api/fivemApi");

module.exports = {
    name: Events.ClientReady,
    async execute(client) {
        client.logs.info(`[FIVEM_RPC] Setting server info as activity...`);

        const updateStatus = async () => {
            const data = await FiveMAPI.getAll();

            let statusText = "Server Maintenance";
            if (data) {
                statusText = `Players: ${data.clients}/${data.sv_maxclients}`;
            }

            client.user.setPresence({
                activities: [{ name: statusText, type: ActivityType.Watching }],
                status: 'online'
            });
        };

        await updateStatus();

        setInterval(updateStatus, 10_000);

        client.logs.success(`[FIVEM_RPC] Server info activity loaded successfully.`);
    }
};