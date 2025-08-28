const { REST } = require("@discordjs/rest");
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const ascii = require("ascii-table");
const { color, getTimestamp } = require('../utils/loggingEffects.js');

const table = new ascii().setHeading("File Name", "Status");

const clientId = process.env.clientid; 
if (!clientId) {
    console.error(`${color.red}[${getTimestamp()}] [SLASH_COMMANDS] No client ID provided. Please provide a valid client ID in the .env file.`);
    return;
}
const guildId = process.env.guildid; 

module.exports = (client) => {
    client.handleCommands = async (commandFolders, path) => {
        client.commandArray = [];
        for (folder of commandFolders) {
            const commandFiles = fs.readdirSync(`${path}/${folder}`).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(`../commands/${folder}/${file}`);
                client.commands.set(command.data.name, command);
                client.commandArray.push(command.data.toJSON());

                if (command.name) {
                    client.commands.set(command.name, command);
                    table.addRow(file, "Loaded");
            
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach((alias) => {
                            client.aliases.set(alias, command.name);
                        });
                    }
                } else {
                    table.addRow(file, "Loaded");
                    continue;
                }
            }
        }

        console.log(`${color.blue}${table.toString()} \n[${getTimestamp()}] ${color.reset}[COMMANDS] Found ${client.commands.size} SlashCommands.`);

        const rest = new REST({
            version: '10'
        }).setToken(process.env.token);

        (async () => {
            try {
                // OPTION 1: Guild-only commands (recommended untuk testing/private bot)
                if (guildId) {
                    client.logs.info(`[SLASH_COMMANDS] Started refreshing guild (/) commands for guild: ${guildId}`);

                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guildId), {
                            body: client.commandArray
                        },
                    ).catch((error) => {
                        console.error(`${color.red}[${getTimestamp()}] [SLASH_COMMANDS] Error while refreshing guild (/) commands:`, error);
                    });

                    client.logs.success(`[SLASH_COMMANDS] Successfully reloaded ${client.commandArray.length} guild (/) commands.`);
                } else {
                    // OPTION 2: Global commands (fallback jika tidak ada guild ID)
                    client.logs.info(`[SLASH_COMMANDS] No guild ID provided, using global commands (limited to 100).`);

                    await rest.put(
                        Routes.applicationCommands(clientId), {
                            body: client.commandArray
                        },
                    ).catch((error) => {
                        console.error(`${color.red}[${getTimestamp()}] [SLASH_COMMANDS] Error while refreshing application (/) commands:`, error);
                    });

                    client.logs.success(`[SLASH_COMMANDS] Successfully reloaded application (/) commands.`);
                }
            } catch (error) {
                console.error(error);
            }
        })();
    };
};