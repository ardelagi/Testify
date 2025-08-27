const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fivemApi = require('../../api/fivemApi');

module.exports = {
    name: 'listplayer',
    aliases: ['players', 'playerlist', 'online', 'who'],
    description: 'Menampilkan daftar player online di server FiveM Motion Life RP',
    usage: 'listplayer',
    category: 'FiveM',
    usableInDms: true,
    async execute(message, client) {
        const serverId = fivemApi.serverDomain;
        
        try {
            // Initialize API jika belum
            if (!fivemApi.isInitialized) {
                fivemApi.initialize(serverId);
            }
            
            const serverData = await fivemApi.getAll(serverId);
            const players = await fivemApi.getPlayers(serverId);
            
            if (serverData.status === 'offline') {
                const offlineEmbed = new EmbedBuilder()
                    .setTitle('**Server Offline**')
                    .setDescription('Server Motion Life RP sedang offline.')
                    .setColor(0xFF0000)
                    .setFooter({ 
                        text: `Requested by ${message.author.username}`, 
                        iconURL: message.author.avatarURL() 
                    })
                    .setTimestamp();
                    
                return await message.channel.send({ embeds: [offlineEmbed] });
            }
            
            if (!players.length) {
                const emptyEmbed = new EmbedBuilder()
                    .setTitle('**No Players Online**')
                    .setDescription(`Server **${serverData.hostname}** sedang kosong.\n\nJoin sekarang: \`${serverId}:30120\``)
                    .setColor(0x808080)
                    .setFooter({ 
                        text: `Requested by ${message.author.username}`, 
                        iconURL: message.author.avatarURL() 
                    })
                    .setTimestamp();
                    
                return await message.channel.send({ embeds: [emptyEmbed] });
            }

            // Sort players by ID (join order) dan filter data valid
            const sortedPlayers = players
                .filter(p => p.name && p.name.trim().length > 0)
                .sort((a, b) => (a.id || 999) - (b.id || 999))
                .map((player, index) => ({
                    id: player.id || '?',
                    name: player.name || 'Unknown',
                    ping: typeof player.ping === 'number' && player.ping > 0 ? `${player.ping}ms` : 'N/A',
                    joinOrder: index + 1
                }));

            const totalPages = Math.ceil(sortedPlayers.length / 10);
            let currentPage = 0;

            // Fungsi untuk membuat embed
            const createEmbed = (page) => {
                const start = page * 10;
                const end = start + 10;
                const currentPlayers = sortedPlayers.slice(start, end);
                
                const playerList = currentPlayers.map(player => {
                    const pingEmoji = getPingEmoji(player.ping);
                    const idPadded = String(player.id).padStart(3, ' ');
                    return `${pingEmoji} \`${idPadded}\` **${player.name}** - \`${player.ping}\``;
                }).join('\n');

                // Statistik ping untuk halaman ini
                const validPings = currentPlayers
                    .map(p => parseInt(p.ping))
                    .filter(ping => !isNaN(ping) && ping > 0);
                
                let pingStats = '';
                if (validPings.length > 0) {
                    const avgPing = Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length);
                    const minPing = Math.min(...validPings);
                    const maxPing = Math.max(...validPings);
                    pingStats = `\n**Page Stats**: Avg: ${avgPing}ms | Range: ${minPing}-${maxPing}ms`;
                }

                return new EmbedBuilder()
                    .setAuthor({ 
                        name: `${client.user.username} ${client.config.devBy}`,
                        iconURL: client.user.avatarURL()
                    })
                    .setTitle(`**${serverData.hostname}**`)
                    .setDescription(`**${sortedPlayers.length}/${serverData.maxPlayers} players online**\n\n${playerList}${pingStats}`)
                    .addFields([
                        {
                            name: '📋 **Legend**',
                            value: '🟢 ≤50ms | 🟡 51-100ms | 🟠 101-150ms | 🔴 >150ms',
                            inline: false
                        }
                    ])
                    .setColor(getServerColor(sortedPlayers.length, serverData.maxPlayers))
                    .setFooter({ 
                        text: `Page ${page + 1}/${totalPages} | Requested by ${message.author.username}`, 
                        iconURL: message.author.avatarURL() 
                    })
                    .setTimestamp();
            };

            // Buat buttons untuk pagination
            const createButtons = (page, totalPages) => {
                const row = new ActionRowBuilder();
                
                // Previous button
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0)
                );

                // Page indicator button
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel(`${page + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                // Next button  
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1)
                );

                // Refresh button
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Success)
                );

                // Close button
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('close')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger)
                );

                return row;
            };

            // Send initial message
            const initialEmbed = createEmbed(currentPage);
            const initialButtons = totalPages > 1 ? createButtons(currentPage, totalPages) : 
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('close')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger)
                );

            const response = await message.channel.send({ 
                embeds: [initialEmbed], 
                components: [initialButtons] 
            });

            // Button collector
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300_000 // 5 minutes
            });

            collector.on('collect', async (interaction) => {
                // Check if user is the one who requested
                if (interaction.user.id !== message.author.id) {
                    return await interaction.reply({ 
                        content: 'Hanya yang meminta command ini yang bisa menggunakan button!', 
                        ephemeral: true 
                    });
                }

                try {
                    switch (interaction.customId) {
                        case 'prev_page':
                            currentPage = Math.max(0, currentPage - 1);
                            break;
                        case 'next_page':
                            currentPage = Math.min(totalPages - 1, currentPage + 1);
                            break;
                        case 'refresh':
                            // Get fresh data
                            const refreshedData = await fivemApi.getAll(serverId);
                            const refreshedPlayers = await fivemApi.getPlayers(serverId);
                            
                            // Update sortedPlayers with fresh data
                            sortedPlayers.length = 0;
                            sortedPlayers.push(...refreshedPlayers
                                .filter(p => p.name && p.name.trim().length > 0)
                                .sort((a, b) => (a.id || 999) - (b.id || 999))
                                .map((player, index) => ({
                                    id: player.id || '?',
                                    name: player.name || 'Unknown',
                                    ping: typeof player.ping === 'number' && player.ping > 0 ? `${player.ping}ms` : 'N/A',
                                    joinOrder: index + 1
                                })));
                            
                            // Recalculate total pages
                            const newTotalPages = Math.ceil(sortedPlayers.length / 10);
                            currentPage = Math.min(currentPage, newTotalPages - 1);
                            break;
                        case 'close':
                            await interaction.update({ 
                                embeds: [initialEmbed.setFooter({ text: 'Player list closed', iconURL: message.author.avatarURL() })], 
                                components: [] 
                            });
                            return collector.stop();
                    }

                    const updatedEmbed = createEmbed(currentPage);
                    const updatedButtons = totalPages > 1 ? createButtons(currentPage, totalPages) :
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('refresh')
                                .setLabel('Refresh')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('close')
                                .setLabel('Close')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await interaction.update({ 
                        embeds: [updatedEmbed], 
                        components: [updatedButtons] 
                    });

                } catch (error) {
                    client.logs.error('[LISTPLAYER_INTERACTION] Error:', error);
                    await interaction.reply({ 
                        content: 'Terjadi error saat memproses interaksi.', 
                        ephemeral: true 
                    });
                }
            });

            collector.on('end', () => {
                // Disable all buttons when collector ends
                const disabledButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('expired')
                        .setLabel('Expired')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                response.edit({ 
                    components: [disabledButtons] 
                }).catch(() => {}); // Ignore errors if message was deleted
            });

        } catch (error) {
            client.logs.error('[LISTPLAYER_COMMAND] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ **Error**')
                .setDescription('Tidak dapat mengambil daftar player. Server mungkin sedang offline atau ada masalah koneksi.')
                .setColor(0xFF0000)
                .setFooter({ 
                    text: `Requested by ${message.author.username}`, 
                    iconURL: message.author.avatarURL() 
                })
                .setTimestamp();
                
            await message.channel.send({ embeds: [errorEmbed] });
        }
    }
};

function getPingEmoji(pingStr) {
    const ping = parseInt(pingStr);
    if (isNaN(ping)) return '⚪';
    if (ping <= 50) return '🟢';
    if (ping <= 100) return '🟡';
    if (ping <= 150) return '🟠';
    return '🔴';
}

function getServerColor(currentPlayers, maxPlayers) {
    const ratio = currentPlayers / maxPlayers;
    if (ratio >= 0.8) return 0xFF0000;      // Red - Full/High
    if (ratio >= 0.5) return 0xFF8C00;      // Orange - Medium-High  
    if (ratio >= 0.3) return 0xFFFF00;      // Yellow - Medium
    if (ratio >= 0.1) return 0x00FF00;      // Green - Low-Medium
    return 0x808080;                        // Gray - Very Low
}