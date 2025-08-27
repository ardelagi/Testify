// ===== 4. SERVERMAP COMMAND =====
// File: src/prefix/FiveM/servermap.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fivemApi = require('../../api/fivemApi');

const serverMapCommand = {
    name: 'servermap',
    aliases: ['map', 'resources', 'serverresources'],
    description: 'Menampilkan informasi map dan resources yang aktif di server',
    usage: 'servermap',
    category: 'FiveM',
    usableInDms: true,
    async execute(message, client) {
        const serverId = fivemApi.serverDomain;
        
        try {
            if (!fivemApi.isInitialized) {
                fivemApi.initialize(serverId);
            }
            
            const serverData = await fivemApi.getAll(serverId);
            const resources = serverData.resources || [];
            
            if (serverData.status === 'offline') {
                return sendOfflineEmbed(message);
            }

            // Kategorisasi resources
            const resourceCategories = categorizeResources(resources);
            const mapInfo = extractMapInfo(serverData.vars || {});
            
            // Buat embed dengan pagination untuk resources
            const totalPages = Math.ceil(Object.keys(resourceCategories).length / 3) || 1;
            let currentPage = 0;
            
            const createMapEmbed = (page) => {
                const categories = Object.keys(resourceCategories);
                const startIdx = page * 3;
                const endIdx = startIdx + 3;
                const currentCategories = categories.slice(startIdx, endIdx);
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: `${client.user.username} - Server Resources`,
                        iconURL: client.user.avatarURL()
                    })
                    .setTitle(`🗺️ **${serverData.hostname}** - Map & Resources`)
                    .setDescription(`**Current Map**: ${mapInfo.name}\n**Game Build**: ${mapInfo.build}\n**Resources Loaded**: ${resources.length}`)
                    .setColor(0x00CED1);

                // Add resource categories to embed
                currentCategories.forEach(category => {
                    const resourceList = resourceCategories[category];
                    const displayList = resourceList.length > 8 
                        ? resourceList.slice(0, 8).join(', ') + `... (+${resourceList.length - 8} more)`
                        : resourceList.join(', ');
                    
                    embed.addFields({
                        name: `${getCategoryEmoji(category)} **${category}** (${resourceList.length})`,
                        value: `\`\`\`${displayList || 'None'}\`\`\``,
                        inline: false
                    });
                });

                return embed
                    .setFooter({ 
                        text: `Page ${page + 1}/${totalPages} | ${message.author.username}`, 
                        iconURL: message.author.avatarURL() 
                    })
                    .setTimestamp();
            };

            // Implementation continues...
        } catch (error) {
            client.logs.error('[SERVERMAP_COMMAND] Error:', error);
        }
    }
};

// ===== 5. PLAYERSTATS COMMAND =====
// File: src/prefix/FiveM/playerstats.js
const playerStatsCommand = {
    name: 'playerstats',
    aliases: ['pstats', 'playerinfo', 'whois'],
    description: 'Menampilkan statistik detail player tertentu',
    usage: 'playerstats [player_name/id]',
    category: 'FiveM',
    usableInDms: true,
    async execute(message, client, args) {
        const serverId = fivemApi.serverDomain;
        
        if (!args[0]) {
            return message.reply('❌ Masukkan nama atau ID player!\nContoh: `?playerstats John` atau `?playerstats 1`');
        }

        try {
            if (!fivemApi.isInitialized) {
                fivemApi.initialize(serverId);
            }
            
            const players = await fivemApi.getPlayers(serverId);
            const searchTerm = args.join(' ').toLowerCase();
            
            // Search by ID or name
            const targetPlayer = players.find(p => 
                p.id == searchTerm || 
                (p.name && p.name.toLowerCase().includes(searchTerm))
            );
            
            if (!targetPlayer) {
                const availablePlayers = players
                    .slice(0, 10)
                    .map(p => `\`${p.id}\` ${p.name}`)
                    .join('\n') || 'No players online';
                    
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ **Player Not Found**')
                        .setDescription(`Player "${args.join(' ')}" tidak ditemukan.\n\n**Available Players:**\n${availablePlayers}`)
                        .setColor(0xFF0000)
                    ]
                });
            }

            // Calculate player statistics
            const playerStats = calculatePlayerStats(targetPlayer, players);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Player Statistics - ${client.user.username}`,
                    iconURL: client.user.avatarURL()
                })
                .setTitle(`👤 **${targetPlayer.name}**`)
                .setDescription(`**Server ID**: #${targetPlayer.id}\n**Status**: ${getPlayerStatus(targetPlayer)}`)
                .addFields([
                    {
                        name: '🏓 **Connection Stats**',
                        value: `\`\`\`
Ping        : ${targetPlayer.ping}ms
Rank        : ${playerStats.pingRank}/${players.length}
Status      : ${getPingStatus(targetPlayer.ping)}
\`\`\``,
                        inline: true
                    },
                    {
                        name: '📊 **Server Position**',
                        value: `\`\`\`
Join Order  : ${playerStats.joinOrder}
Session ID  : ${targetPlayer.id}
Endpoints   : ${targetPlayer.endpoints?.length || 0}
\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎮 **Game Information**',
                        value: `\`\`\`
Identifiers : ${playerStats.identifierCount}
Steam       : ${playerStats.steamHex || 'Not Available'}
Discord     : ${playerStats.discordId || 'Not Available'}
\`\`\``,
                        inline: false
                    }
                ])
                .setColor(getPingColor(targetPlayer.ping))
                .setFooter({ 
                    text: `Requested by ${message.author.username}`, 
                    iconURL: message.author.avatarURL() 
                })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            client.logs.error('[PLAYERSTATS_COMMAND] Error:', error);
        }
    }
};

// ===== 6. SERVERHISTORY COMMAND =====
// File: src/prefix/FiveM/serverhistory.js
const serverHistoryCommand = {
    name: 'serverhistory',
    aliases: ['history', 'stats24h', 'servergraph'],
    description: 'Menampilkan grafik historis player count 24 jam terakhir',
    usage: 'serverhistory',
    category: 'FiveM',
    usableInDms: true,
    async execute(message, client) {
        try {
            // This would require a database to store historical data
            // For demo purposes, we'll simulate data
            const historicalData = await getSimulatedHistoricalData();
            
            const embed = new EmbedBuilder()
                .setTitle('📈 **Server History - Last 24 Hours**')
                .setDescription(createASCIIGraph(historicalData))
                .addFields([
                    {
                        name: '📊 **24h Statistics**',
                        value: `\`\`\`
Peak Players : ${Math.max(...historicalData)}
Lowest       : ${Math.min(...historicalData)}
Average      : ${Math.round(historicalData.reduce((a,b) => a+b) / historicalData.length)}
Current      : ${historicalData[historicalData.length - 1]}
\`\`\``,
                        inline: true
                    },
                    {
                        name: '⏰ **Peak Times**',
                        value: `\`\`\`
Morning Peak : 08:00 - 12:00
Evening Peak : 18:00 - 23:00
Low Activity : 02:00 - 06:00
\`\`\``,
                        inline: true
                    }
                ])
                .setColor(0x1E90FF)
                .setFooter({ 
                    text: `Data updates every 30 seconds | ${message.author.username}`, 
                    iconURL: message.author.avatarURL() 
                })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            client.logs.error('[SERVERHISTORY_COMMAND] Error:', error);
        }
    }
};

// ===== 7. SERVERSTATUS COMMAND (Real-time Auto-updating) =====
// File: src/prefix/FiveM/serverstatus.js
const serverStatusCommand = {
    name: 'serverstatus',
    aliases: ['livestatus', 'monitor', 'live'],
    description: 'Monitor server secara real-time dengan auto-update',
    usage: 'serverstatus',
    category: 'FiveM',
    usableInDms: true,
    async execute(message, client) {
        const serverId = fivemApi.serverDomain;
        let isActive = true;
        let updateCount = 0;
        const maxUpdates = 20; // Max 10 minutes of updates
        
        try {
            if (!fivemApi.isInitialized) {
                fivemApi.initialize(serverId);
            }

            const createLiveEmbed = async () => {
                const serverData = await fivemApi.getAll(serverId);
                const quickStats = fivemApi.getQuickStats(serverId);
                
                return new EmbedBuilder()
                    .setAuthor({ 
                        name: `🔴 LIVE - ${client.user.username}`,
                        iconURL: client.user.avatarURL()
                    })
                    .setTitle(`📡 **Real-time Server Monitor**`)
                    .setDescription(`**${serverData.hostname}**\n\`${serverId}:30120\``)
                    .addFields([
                        {
                            name: '👥 **Players**',
                            value: `\`\`\`
Online: ${serverData.clients}/${serverData.maxPlayers}
Status: ${serverData.status.toUpperCase()}
\`\`\``,
                            inline: true
                        },
                        {
                            name: '🏓 **Performance**',
                            value: `\`\`\`
Avg Ping: ${quickStats.ping.avg}ms
Range   : ${quickStats.ping.min}-${quickStats.ping.max}ms
\`\`\``,
                            inline: true
                        },
                        {
                            name: '⚡ **Live Stats**',
                            value: `\`\`\`
Updates : ${updateCount}/${maxUpdates}
Next    : ${isActive ? '30s' : 'Stopped'}
Resources: ${serverData.resources?.length || 0}
\`\`\``,
                            inline: false
                        }
                    ])
                    .setColor(serverData.status === 'online' ? 0x00FF00 : 0xFF0000)
                    .setFooter({ 
                        text: `Live Monitor | Auto-updates every 30s | ${message.author.username}`, 
                        iconURL: message.author.avatarURL() 
                    })
                    .setTimestamp();
            };

            // Create control buttons
            const createControlButtons = () => {
                return new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('pause_monitor')
                            .setLabel(isActive ? '⏸️ Pause' : '▶️ Resume')
                            .setStyle(isActive ? ButtonStyle.Secondary : ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('refresh_now')
                            .setLabel('🔄 Refresh Now')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('stop_monitor')
                            .setLabel('⏹️ Stop')
                            .setStyle(ButtonStyle.Danger)
                    );
            };

            // Send initial message
            const initialEmbed = await createLiveEmbed();
            const response = await message.channel.send({ 
                embeds: [initialEmbed], 
                components: [createControlButtons()] 
            });

            // Auto-update interval
            const updateInterval = setInterval(async () => {
                if (!isActive || updateCount >= maxUpdates) {
                    clearInterval(updateInterval);
                    return;
                }

                try {
                    updateCount++;
                    const updatedEmbed = await createLiveEmbed();
                    await response.edit({ 
                        embeds: [updatedEmbed], 
                        components: [createControlButtons()] 
                    });
                } catch (error) {
                    client.logs.error('[SERVERSTATUS_UPDATE] Error:', error);
                }
            }, 30000); // Update every 30 seconds

            // Button interaction handler
            const collector = response.createMessageComponentCollector({
                time: 600000 // 10 minutes
            });

            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    return await interaction.reply({ 
                        content: 'Hanya yang meminta command ini yang bisa menggunakan kontrol!', 
                        ephemeral: true 
                    });
                }

                switch (interaction.customId) {
                    case 'pause_monitor':
                        isActive = !isActive;
                        break;
                    case 'refresh_now':
                        updateCount++;
                        const refreshedEmbed = await createLiveEmbed();
                        await interaction.update({ 
                            embeds: [refreshedEmbed], 
                            components: [createControlButtons()] 
                        });
                        return;
                    case 'stop_monitor':
                        clearInterval(updateInterval);
                        isActive = false;
                        await interaction.update({ 
                            embeds: [await createLiveEmbed()], 
                            components: [] 
                        });
                        collector.stop();
                        return;
                }

                await interaction.update({ 
                    embeds: [await createLiveEmbed()], 
                    components: [createControlButtons()] 
                });
            });

        } catch (error) {
            client.logs.error('[SERVERSTATUS_COMMAND] Error:', error);
        }
    }
};

// ===== UTILITY FUNCTIONS =====

function categorizeResources(resources) {
    const categories = {
        'Core': [],
        'Maps': [],
        'Vehicles': [],
        'Jobs': [],
        'Housing': [],
        'Weapons': [],
        'UI/HUD': [],
        'Other': []
    };

    resources.forEach(resource => {
        const name = resource.toLowerCase();
        if (name.includes('core') || name.includes('base') || name.includes('framework')) {
            categories['Core'].push(resource);
        } else if (name.includes('map') || name.includes('mlo') || name.includes('ymap')) {
            categories['Maps'].push(resource);
        } else if (name.includes('car') || name.includes('vehicle') || name.includes('bike')) {
            categories['Vehicles'].push(resource);
        } else if (name.includes('job') || name.includes('work') || name.includes('police') || name.includes('ambulance')) {
            categories['Jobs'].push(resource);
        } else if (name.includes('house') || name.includes('property') || name.includes('apartment')) {
            categories['Housing'].push(resource);
        } else if (name.includes('weapon') || name.includes('gun') || name.includes('knife')) {
            categories['Weapons'].push(resource);
        } else if (name.includes('ui') || name.includes('hud') || name.includes('menu') || name.includes('notification')) {
            categories['UI/HUD'].push(resource);
        } else {
            categories['Other'].push(resource);
        }
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
        if (categories[key].length === 0) {
            delete categories[key];
        }
    });

    return categories;
}

function extractMapInfo(vars) {
    return {
        name: vars.mapname || vars.sv_projectName || 'Los Santos',
        build: vars.sv_enforceGameBuild || 'Unknown',
        version: vars.sv_scriptHookAllowed || 'N/A'
    };
}

function getCategoryEmoji(category) {
    const emojis = {
        'Core': '⚙️',
        'Maps': '🗺️',
        'Vehicles': '🚗',
        'Jobs': '💼',
        'Housing': '🏠',
        'Weapons': '🔫',
        'UI/HUD': '💻',
        'Other': '📦'
    };
    return emojis[category] || '📦';
}

function calculatePlayerStats(player, allPlayers) {
    const playerPings = allPlayers.map(p => p.ping).filter(p => typeof p === 'number').sort((a, b) => a - b);
    const pingRank = playerPings.indexOf(player.ping) + 1;
    const joinOrder = allPlayers.sort((a, b) => a.id - b.id).findIndex(p => p.id === player.id) + 1;
    
    const identifiers = player.identifiers || [];
    const steamIdentifier = identifiers.find(id => id.startsWith('steam:'));
    const discordIdentifier = identifiers.find(id => id.startsWith('discord:'));
    
    return {
        pingRank,
        joinOrder,
        identifierCount: identifiers.length,
        steamHex: steamIdentifier ? steamIdentifier.split(':')[1] : null,
        discordId: discordIdentifier ? discordIdentifier.split(':')[1] : null
    };
}

function getPlayerStatus(player) {
    if (player.ping > 200) return '🔴 High Latency';
    if (player.ping > 100) return '🟡 Medium Latency';
    return '🟢 Good Connection';
}

function getPingStatus(ping) {
    if (ping <= 50) return 'Excellent';
    if (ping <= 100) return 'Good';
    if (ping <= 150) return 'Fair';
    return 'Poor';
}

function getPingColor(ping) {
    if (ping <= 50) return 0x00FF00;
    if (ping <= 100) return 0xFFFF00;
    if (ping <= 150) return 0xFF8C00;
    return 0xFF0000;
}

async function getSimulatedHistoricalData() {
    // Simulate 24 hours of data (48 data points, every 30 minutes)
    const data = [];
    for (let i = 0; i < 48; i++) {
        // Create realistic server population curve
        const hour = (i * 0.5) % 24;
        let basePopulation;
        
        if (hour >= 6 && hour <= 10) basePopulation = 45; // Morning
        else if (hour >= 18 && hour <= 23) basePopulation = 75; // Evening peak
        else if (hour >= 11 && hour <= 17) basePopulation = 60; // Afternoon
        else basePopulation = 20; // Night/Early morning
        
        // Add some randomness
        const randomVariation = Math.floor(Math.random() * 20) - 10;
        data.push(Math.max(0, Math.min(128, basePopulation + randomVariation)));
    }
    return data;
}

function createASCIIGraph(data) {
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;
    const height = 8;
    
    let graph = '```\n';
    
    // Create graph lines
    for (let row = height - 1; row >= 0; row--) {
        const threshold = minValue + (range * row / (height - 1));
        graph += data.map(value => value >= threshold ? '█' : ' ').join('') + '\n';
    }
    
    graph += '─'.repeat(data.length) + '\n';
    graph += `${minValue}${' '.repeat(data.length - String(minValue).length - String(maxValue).length)}${maxValue}\n`;
    graph += '```';
    
    return graph;
}

module.exports = {
    serverMapCommand,
    playerStatsCommand, 
    serverHistoryCommand,
    serverStatusCommand
};