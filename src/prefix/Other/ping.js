const { EmbedBuilder } = require('discord.js');
const fivemApi = require('../../api/fivemApi');

module.exports = {
    name: 'ping',
    aliases: ['pinginfo', 'serverpings', 'pingstats'],
    description: 'Menampilkan statistik ping server FiveM Motion Life RP',
    usage: 'infoping',
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
            const players = await fivemApi.getPlayers(serverId);
            
            if (serverData.status === 'offline') {
                const offlineEmbed = new EmbedBuilder()
                    .setTitle('🔴 **Server Offline**')
                    .setDescription('Server Motionlife Roleplay sedang offline. Tidak dapat mengambil data ping.')
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
                    .setTitle('⚪ **No Players Online**')
                    .setDescription('Tidak ada player online saat ini untuk menampilkan statistik ping.')
                    .setColor(0x808080)
                    .setFooter({ 
                        text: `Requested by ${message.author.username}`, 
                        iconURL: message.author.avatarURL() 
                    })
                    .setTimestamp();
                    
                return await message.channel.send({ embeds: [emptyEmbed] });
            }

            // Ambil data ping dari semua players
            const validPings = players
                .map(p => p.ping)
                .filter(ping => typeof ping === 'number' && ping > 0)
                .sort((a, b) => a - b);
            
            if (!validPings.length) {
                const noPingEmbed = new EmbedBuilder()
                    .setTitle('⚠️ **No Ping Data Available**')
                    .setDescription('Data ping tidak tersedia untuk player yang sedang online.')
                    .setColor(0xFFFF00)
                    .setFooter({ 
                        text: `Requested by ${message.author.username}`, 
                        iconURL: message.author.avatarURL() 
                    })
                    .setTimestamp();
                    
                return await message.channel.send({ embeds: [noPingEmbed] });
            }

            // Hitung statistik ping
            const minPing = Math.min(...validPings);
            const maxPing = Math.max(...validPings);
            const avgPing = Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length);
            const medianPing = validPings.length % 2 === 0 
                ? Math.round((validPings[validPings.length / 2 - 1] + validPings[validPings.length / 2]) / 2)
                : validPings[Math.floor(validPings.length / 2)];

            // Kategorisasi ping
            const pingCategories = {
                excellent: validPings.filter(p => p <= 50).length,
                good: validPings.filter(p => p > 50 && p <= 100).length,
                fair: validPings.filter(p => p > 100 && p <= 150).length,
                poor: validPings.filter(p => p > 150).length
            };

            // Temukan players dengan ping terendah dan tertinggi
            const bestPlayer = players.find(p => p.ping === minPing);
            const worstPlayer = players.find(p => p.ping === maxPing);

            // Buat progress bar untuk distribusi ping
            const totalPlayers = validPings.length;
            const excellentBar = createMiniProgressBar(pingCategories.excellent / totalPlayers, 8);
            const goodBar = createMiniProgressBar(pingCategories.good / totalPlayers, 8);
            const fairBar = createMiniProgressBar(pingCategories.fair / totalPlayers, 8);
            const poorBar = createMiniProgressBar(pingCategories.poor / totalPlayers, 8);

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: `${client.user.username} ${client.config.devBy}`,
                    iconURL: client.user.avatarURL()
                })
                .setTitle(`**Motionlife Roleplay - Ping Statistics**`)
                .setDescription(`📊 **Analyzing ${validPings.length} players with valid ping data**`)
                .addFields([
                    {
                        name: '📈 **Ping Statistics**',
                        value: `\`\`\`
Lowest   : ${minPing}ms
Highest  : ${maxPing}ms  
Average  : ${avgPing}ms
Median   : ${medianPing}ms
Range    : ${maxPing - minPing}ms
\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎯 **Best & Worst**',
                        value: `\`\`\`
🟢 Best : ${bestPlayer?.name || 'Unknown'}
   Ping : ${minPing}ms

🔴 Worst: ${worstPlayer?.name || 'Unknown'}  
   Ping : ${maxPing}ms
\`\`\``,
                        inline: true
                    },
                    {
                        name: '📊 **Ping Distribution**',
                        value: `\`\`\`
🟢 Excellent (≤50ms) : ${pingCategories.excellent} players
${excellentBar} ${Math.round((pingCategories.excellent/totalPlayers)*100)}%

🟡 Good (51-100ms)   : ${pingCategories.good} players  
${goodBar} ${Math.round((pingCategories.good/totalPlayers)*100)}%

🟠 Fair (101-150ms)  : ${pingCategories.fair} players
${fairBar} ${Math.round((pingCategories.fair/totalPlayers)*100)}%

🔴 Poor (>150ms)     : ${pingCategories.poor} players
${poorBar} ${Math.round((pingCategories.poor/totalPlayers)*100)}%
\`\`\``,
                        inline: false
                    }
                ])
                .setColor(getPingColor(avgPing))
                .setFooter({ 
                    text: `Requested by ${message.author.username} | ${serverData.clients}/${serverData.maxPlayers} online`, 
                    iconURL: message.author.avatarURL() 
                })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            client.logs.error('[INFOPING_COMMAND] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ **Error**')
                .setDescription('Tidak dapat mengambil data ping server. Coba lagi nanti.')
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

function createMiniProgressBar(ratio, length) {
    const filled = Math.round(ratio * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function getPingColor(avgPing) {
    if (avgPing <= 50) return 0x00FF00;    // Green - Excellent
    if (avgPing <= 100) return 0xFFFF00;   // Yellow - Good  
    if (avgPing <= 150) return 0xFF8C00;   // Orange - Fair
    return 0xFF0000;                       // Red - Poor
}