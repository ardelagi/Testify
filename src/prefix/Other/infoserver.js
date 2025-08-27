const { EmbedBuilder } = require('discord.js');
const fivemApi = require('../../api/fivemApi');

module.exports = {
    name: 'infoserver',
    aliases: ['serverinfo', 'infokota', 'motioninfo'],
    description: 'Menampilkan informasi lengkap server FiveM Motion Life RP',
    usage: 'infoserver',
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
            const quickStats = fivemApi.getQuickStats(serverId);
            
            // Tentukan emoji status
            const statusEmojis = {
                'online': '🟢',
                'offline': '🔴',
                'maintenance': '🟡',
                'loading': '⏳'
            };
            
            const statusEmoji = statusEmojis[serverData.status] || '⚪';
            
            // Tentukan warna embed berdasarkan status
            const statusColors = {
                'online': 0x00FF00,      // Green
                'offline': 0xFF0000,     // Red
                'maintenance': 0xFFFF00, // Yellow
                'loading': 0x808080      // Gray
            };
            
            const embedColor = statusColors[serverData.status] || client.config.embedCommunity;
            
            // Format uptime
            const uptimeSeconds = Math.floor((Date.now() - serverData.lastUpdate) / 1000);
            const uptimeFormatted = formatUptime(uptimeSeconds);
            
            // Progress bar untuk players
            const playerRatio = serverData.maxPlayers > 0 ? (serverData.clients / serverData.maxPlayers) : 0;
            const progressBar = createProgressBar(playerRatio, 10);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: `${client.user.username} ${client.config.devBy}`,
                    iconURL: client.user.avatarURL()
                })
                .setTitle(`${statusEmoji} **${serverData.hostname}**`)
                .setDescription(`**Status Server** ${serverData.status.toUpperCase()}`)
                .addFields([
                    {
                        name: '👥 **Players Online**',
                        value: `\`\`\`
${serverData.clients}/${serverData.maxPlayers} players
${progressBar} ${Math.round(playerRatio * 100)}%
\`\`\``,
                        inline: true
                    },
                    {
                        name: '🌐 **Server Info**',
                        value: `\`\`\`
IP: ${serverId}
Ping: ${serverData.ping}ms
Resources: ${serverData.resources?.length || 0}
\`\`\``,
                        inline: true
                    },
                    {
                        name: '⏰ **Server Uptime**',
                        value: `\`\`\`
Last Update: ${uptimeFormatted}
Status: ${serverData.status}
\`\`\``,
                        inline: false
                    }
                ])
                .setColor(embedColor)
                .setFooter({ 
                    text: `Requested by ${message.author.username} | Data updated every 30s`, 
                    iconURL: message.author.avatarURL() 
                })
                .setTimestamp();

            // Tambah field tambahan jika server online
            if (serverData.status === 'online' && serverData.clients > 0) {
                if (quickStats.topPlayers.length > 0 && quickStats.topPlayers[0] !== "None") {
                    embed.addFields({
                        name: '🏆 **Top Players (First Joiners)**',
                        value: `\`\`\`
${quickStats.topPlayers.slice(0, 3).map((name, i) => `${i + 1}. ${name}`).join('\n')}
\`\`\``,
                        inline: false
                    });
                }
            }

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            client.logs.error('[INFOSERVER_COMMAND] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ **Error**')
                .setDescription('Tidak dapat mengambil informasi server. Server mungkin sedang offline atau ada masalah koneksi.')
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

function createProgressBar(ratio, length) {
    const filled = Math.round(ratio * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}