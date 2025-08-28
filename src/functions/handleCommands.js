const { REST } = require("@discordjs/rest");
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const ascii = require("ascii-table");
const { color, getTimestamp } = require('../utils/loggingEffects.js');

const table = new ascii().setHeading("File Name", "Status");

const clientId = process.env.clientid; 
const guildId = process.env.guildid;
const useGuildCommands = process.env.USE_GUILD_COMMANDS === 'true'; // Add this to .env

module.exports = (client) => {
    client.handleCommands = async (commandFolders, path) => {
        client.commandArray = [];
        client.guildCommandArray = []; // For guild-specific commands
        client.globalCommandArray = []; // For global commands

        for (folder of commandFolders) {
            const commandFiles = fs.readdirSync(`${path}/${folder}`).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(`../commands/${folder}/${file}`);
                client.commands.set(command.data.name, command);
                
                // Check if command should be guild-only (you can add a property to commands)
                if (command.guildOnly || useGuildCommands) {
                    client.guildCommandArray.push(command.data.toJSON());
                } else {
                    client.globalCommandArray.push(command.data.toJSON());
                }

                client.commandArray.push(command.data.toJSON());

                if (command.name) {
                    client.commands.set(command.name, command);
                    table.addRow(file, useGuildCommands ? "Guild Loaded" : "Global Loaded");
            
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach((alias) => {
                            client.aliases.set(alias, command.name);
                        });
                    }
                } else {
                    table.addRow(file, useGuildCommands ? "Guild Loaded" : "Global Loaded");
                    continue;
                }
            }
        }

        console.log(`${color.blue}${table.toString()} \n[${getTimestamp()}] ${color.reset}[COMMANDS] Found ${client.commands.size} SlashCommands.`);

        const rest = new REST({ version: '10' }).setToken(process.env.token);

        (async () => {
            try {
                if (useGuildCommands && guildId) {
                    // Deploy to specific guild (no limit, instant)
                    client.logs.info(`[SLASH_COMMANDS] Deploying ${client.guildCommandArray.length} commands to guild: ${guildId}`);

                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guildId), {
                            body: client.guildCommandArray
                        }
                    );

                    client.logs.success(`[SLASH_COMMANDS] Successfully deployed guild commands.`);
                } else {
                    // Deploy globally (max 100, 1 hour delay)
                    if (client.globalCommandArray.length > 100) {
                        client.logs.warn(`[SLASH_COMMANDS] Warning: ${client.globalCommandArray.length} commands exceed 100 global limit!`);
                    }

                    client.logs.info(`[SLASH_COMMANDS] Deploying ${client.globalCommandArray.length} global commands.`);

                    await rest.put(
                        Routes.applicationCommands(clientId), {
                            body: client.globalCommandArray
                        }
                    );

                    client.logs.success(`[SLASH_COMMANDS] Successfully deployed global commands.`);
                }
            } catch (error) {
                console.error(`${color.red}[${getTimestamp()}] [SLASH_COMMANDS] Deployment error:`, error);
            }
        })();
    };
};