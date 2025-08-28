const { REST } = require("@discordjs/rest");
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const ascii = require("ascii-table");
const { color, getTimestamp } = require('../utils/loggingEffects.js');

const table = new ascii().setHeading("File Name", "Type", "Status");

const clientId = process.env.clientid; 
const guildId = process.env.guildid;
const useGuildCommands = process.env.USE_GUILD_COMMANDS === 'true';

module.exports = (client) => {
    client.handleCommands = async (commandFolders, path) => {
        client.commandArray = [];
        client.guildCommandArray = [];
        client.globalCommandArray = [];

        // Debug: Log settings
        console.log(`${color.yellow}[${getTimestamp()}] [DEBUG] USE_GUILD_COMMANDS: ${useGuildCommands}${color.reset}`);
        console.log(`${color.yellow}[${getTimestamp()}] [DEBUG] GUILD_ID: ${guildId}${color.reset}`);

        // ===== STRATEGI: HANYA COMMANDS SENSITIF KE GUILD =====
        // Categories yang WAJIB guild-only (commands berbahaya/sensitif)
        const forceGuildCategories = [
            'AI Commands',
            'Admin Commands', 
            'Moderation',
            'Developer Commands',
            'Setup Commands'
        ];

        // Commands yang WAJIB guild-only (berdasarkan nama)
        const forceGuildCommands = [
            'motionlife-ai',
            'setup-motionlife-ai', 
            'eval',
            'ban',
            'kick',
            'mute',
            'timeout',
            'clear',
            'purge'
        ];

        // Commands yang SELALU global (override semua setting)
        const alwaysGlobalCommands = [
            'help',
            'ping',
            'info',
            'avatar',
            'userinfo',
            'serverinfo',
            'invite'
        ];

        for (folder of commandFolders) {
            const commandFiles = fs.readdirSync(`${path}/${folder}`).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const command = require(`../commands/${folder}/${file}`);
                
                if (!command.data || !command.data.name) {
                    table.addRow(file, "INVALID", "❌");
                    continue;
                }

                client.commands.set(command.data.name, command);
                
                const commandName = command.data.name;
                const commandCategory = command.category;
                
                // ===== PERBAIKAN LOGIC DEPLOYMENT =====
                let deploymentType = "GLOBAL";
                let shouldBeGuild = false;

                // 1. Cek always global commands (prioritas tertinggi)
                if (alwaysGlobalCommands.includes(commandName)) {
                    shouldBeGuild = false;
                    deploymentType = "GLOBAL (forced)";
                }
                // 2. Cek force guild commands
                else if (forceGuildCommands.includes(commandName)) {
                    shouldBeGuild = true;
                    deploymentType = "GUILD (forced)";
                }
                // 3. Cek force guild categories
                else if (commandCategory && forceGuildCategories.includes(commandCategory)) {
                    shouldBeGuild = true;
                    deploymentType = "GUILD (category)";
                }
                // 4. Cek property guildOnly di command
                else if (command.guildOnly === true) {
                    shouldBeGuild = true;
                    deploymentType = "GUILD (property)";
                }
                // 5. Default ke global (PENTING: ini berbeda dari logic sebelumnya)
                else {
                    shouldBeGuild = false;
                    deploymentType = "GLOBAL (default)";
                }

                // Deploy berdasarkan hasil check
                if (shouldBeGuild && guildId) {
                    client.guildCommandArray.push(command.data.toJSON());
                    table.addRow(file, deploymentType, "🏠");
                } else {
                    client.globalCommandArray.push(command.data.toJSON());
                    table.addRow(file, deploymentType, "🌍");
                }

                // Tambahkan ke total array (untuk counting)
                client.commandArray.push(command.data.toJSON());

                // Handle prefix commands (jika ada)
                if (command.name) {
                    client.commands.set(command.name, command);
                    
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach((alias) => {
                            client.aliases.set(alias, command.name);
                        });
                    }
                }
            }
        }

        // Debug: Show counts
        console.log(`${color.blue}${table.toString()}${color.reset}`);
        console.log(`${color.cyan}[${getTimestamp()}] [COMMANDS] Total Commands: ${client.commandArray.length}${color.reset}`);
        console.log(`${color.green}[${getTimestamp()}] [COMMANDS] Guild Commands: ${client.guildCommandArray.length}${color.reset}`);
        console.log(`${color.yellow}[${getTimestamp()}] [COMMANDS] Global Commands: ${client.globalCommandArray.length}${color.reset}`);

        // ===== VALIDASI SEBELUM DEPLOY =====
        if (client.globalCommandArray.length > 100) {
            console.log(`${color.red}[${getTimestamp()}] [ERROR] Too many global commands (${client.globalCommandArray.length}/100)!${color.reset}`);
            console.log(`${color.red}[${getTimestamp()}] [ERROR] Please add more commands to guildOnly or use USE_GUILD_COMMANDS=true${color.reset}`);
            return;
        }

        if (client.guildCommandArray.length > 100 && guildId) {
            console.log(`${color.red}[${getTimestamp()}] [ERROR] Too many guild commands (${client.guildCommandArray.length}/100)!${color.reset}`);
            return;
        }

        const rest = new REST({ version: '10' }).setToken(process.env.token);

        (async () => {
            try {
                // ===== DEPLOY GUILD COMMANDS =====
                if (guildId && client.guildCommandArray.length > 0) {
                    client.logs.info(`[SLASH_COMMANDS] Deploying ${client.guildCommandArray.length} commands to guild: ${guildId}`);

                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guildId), {
                            body: client.guildCommandArray
                        }
                    );

                    client.logs.success(`[SLASH_COMMANDS] Successfully deployed guild commands.`);
                }

                // ===== DEPLOY GLOBAL COMMANDS =====
                if (client.globalCommandArray.length > 0) {
                    client.logs.info(`[SLASH_COMMANDS] Deploying ${client.globalCommandArray.length} global commands.`);

                    await rest.put(
                        Routes.applicationCommands(clientId), {
                            body: client.globalCommandArray
                        }
                    );

                    client.logs.success(`[SLASH_COMMANDS] Successfully deployed global commands.`);
                }

                // ===== HAPUS COMMANDS YANG TIDAK DIGUNAKAN =====
                // Jika sebelumnya ada global commands tapi sekarang semua guild
                if (useGuildCommands && client.globalCommandArray.length === 0) {
                    client.logs.info(`[SLASH_COMMANDS] Clearing all global commands...`);
                    await rest.put(Routes.applicationCommands(clientId), { body: [] });
                    client.logs.success(`[SLASH_COMMANDS] Global commands cleared.`);
                }

            } catch (error) {
                console.error(`${color.red}[${getTimestamp()}] [SLASH_COMMANDS] Deployment error:${color.reset}`, error);
                
                // Debug tambahan untuk error deployment
                if (error.code === 30032) {
                    console.log(`${color.red}[${getTimestamp()}] [ERROR] Command limit exceeded!${color.reset}`);
                    console.log(`${color.red}[${getTimestamp()}] [ERROR] Try setting USE_GUILD_COMMANDS=true in .env${color.reset}`);
                }
            }
        })();
    };
};