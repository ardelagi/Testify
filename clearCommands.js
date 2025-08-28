require('dotenv').config();
const { REST } = require("@discordjs/rest");
const { Routes } = require('discord-api-types/v10');

const clientId = process.env.development.clientid;
const guildId = process.env.development.guildid;
const rest = new REST({ version: '10' }).setToken(process.env.development.token);

async function clearAllCommands() {
    try {
        console.log('🧹 Starting command cleanup...');
        
        // Clear global commands
        console.log('📡 Clearing global commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('✅ Global commands cleared!');
        
        // Clear guild commands
        if (guildId) {
            console.log(`🏠 Clearing guild commands for ${guildId}...`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log('✅ Guild commands cleared!');
        }
        
        console.log('🎉 All commands cleared! You can now restart the bot.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing commands:', error);
        process.exit(1);
    }
}

clearAllCommands();