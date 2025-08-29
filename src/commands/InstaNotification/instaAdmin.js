const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const InstagramSchema = require('../../schemas/instaNotificationSystem');
const instagramApi = require('../../api/instagramApi');
const { color, getTimestamp } = require('../../utils/loggingEffects');

module.exports = {
    usableInDms: false,
    category: 'Admin Commands',
    permissions: [PermissionFlagsBits.Administrator],
    data: new SlashCommandBuilder()
        .setName('insta-admin')
        .setDescription('Advanced Instagram notification management')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => 
            subcommand
                .setName('status')
                .setDescription('Check Instagram API system status')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('switch-mode')
                .setDescription('Manually switch Instagram API mode')
                .addStringOption(option => 
                    option
                        .setName('mode')
                        .setDescription('API mode to switch to')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Puppeteer (Primary)', value: 'puppeteer' },
                            { name: 'RSSHub (Backup)', value: 'rsshub' }
                        )
                )
                .addStringOption(option => 
                    option
                        .setName('username')
                        .setDescription('Apply to specific user (leave empty for global)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('reset-fallback')
                .setDescription('Reset the fallback system to default state')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('test-user')
                .setDescription('Test Instagram API for specific user')
                .addStringOption(option => 
                    option
                        .setName('username')
                        .setDescription('Instagram username to test')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permissions to use this command!',
                ephemeral: true
            });
        }

        await interaction.deferReply();
        
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'status': {
                try {
                    const health = instagramApi.getSystemHealth();
                    const status = instagramApi.getFallbackStatus();
                    
                    // Create comprehensive status embed
                    const embed = new EmbedBuilder()
                        .setAuthor({ 
                            name: `Instagram API System Status`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setColor(this.getStatusColor(health.healthScore))
                        .setTitle(`${client.user.username} Instagram Monitoring System`)
                        .addFields(
                            {
                                name: '🎯 Current Status',
                                value: [
                                    `**Primary Mode:** ${status.currentMode.toUpperCase()}`,
                                    `**Health Score:** ${health.healthScore}%`,
                                    `**Fail Count:** ${status.failCount}/${instagramApi.fallbackConfig.MAX_FAIL_COUNT}`,
                                    `**Active Users:** ${health.activeUsers.length}`
                                ].join('\n'),
                                inline: true
                            },
                            {
                                name: '📊 Performance Stats',
                                value: [
                                    `**Puppeteer:** ✅ ${status.stats.puppeteer.success} | ❌ ${status.stats.puppeteer.failures}`,
                                    `**RSSHub:** ✅ ${status.stats.rsshub.success} | ❌ ${status.stats.rsshub.failures}`,
                                    `**Avg Response Time:**`,
                                    `• Puppeteer: ${health.avgResponseTime.puppeteer}ms`,
                                    `• RSSHub: ${health.avgResponseTime.rsshub}ms`
                                ].join('\n'),
                                inline: true
                            },
                            {
                                name: '🔄 Fallback Info',
                                value: [
                                    `**Total Switches:** ${status.totalSwitches}`,
                                    `**Fallbacks Triggered:** ${status.stats.fallbacksTriggered}`,
                                    `**Recovery Attempts:** ${status.stats.recoveryAttempts}`,
                                    `**Puppeteer Active:** ${health.isPuppeteerActive ? '✅' : '❌'}`
                                ].join('\n'),
                                inline: false
                            }
                        )
                        .setTimestamp();

                    // Add cooldown info if applicable
                    if (status.cooldownRemaining > 0) {
                        const cooldownMinutes = Math.ceil(status.cooldownRemaining / 60000);
                        embed.addFields({
                            name: '⏱️ Recovery Cooldown',
                            value: `Puppeteer recovery in ${cooldownMinutes} minutes`,
                            inline: false
                        });
                    }

                    // Add recent mode changes
                    if (status.recentHistory && status.recentHistory.length > 0) {
                        const historyText = status.recentHistory
                            .map(h => `${new Date(h.timestamp).toLocaleTimeString()} - ${h.mode.toUpperCase()} (${h.reason})`)
                            .join('\n');
                        
                        embed.addFields({
                            name: '📝 Recent Mode Changes',
                            value: `\`\`\`${historyText}\`\`\``,
                            inline: false
                        });
                    }

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_ADMIN] Error getting status: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: '❌ Error retrieving system status!'
                    });
                }
                break;
            }

            case 'switch-mode': {
                const mode = interaction.options.getString('mode');
                const username = interaction.options.getString('username');
                
                try {
                    const result = await instagramApi.switchMode(mode, username);
                    
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `Instagram API Mode Switch` })
                        .setColor(mode === 'puppeteer' ? '#00ff00' : '#ff6600')
                        .setTitle(`✅ Mode Switch Successful`)
                        .setDescription([
                            `**Target:** ${username || 'Global'}`,
                            `**Previous Mode:** ${result.oldMode.toUpperCase()}`,
                            `**New Mode:** ${result.newMode.toUpperCase()}`,
                            '',
                            username 
                                ? `User ${username} will now use ${mode.toUpperCase()} mode`
                                : `All users will now default to ${mode.toUpperCase()} mode`
                        ].join('\n'))
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_ADMIN] Error switching mode: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: '❌ Error switching API mode!'
                    });
                }
                break;
            }

            case 'reset-fallback': {
                try {
                    const oldStatus = instagramApi.getFallbackStatus();
                    
                    instagramApi.resetFallbackSystem();
                    
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `Instagram Fallback System Reset` })
                        .setColor('#00ff00')
                        .setTitle(`🔄 Fallback System Reset`)
                        .setDescription([
                            '**System has been reset to default state:**',
                            '',
                            '✅ Mode reset to Puppeteer',
                            '✅ Fail count cleared',
                            '✅ Cooldowns removed',
                            '✅ User-specific modes cleared',
                            '',
                            `**Previous State:**`,
                            `• Mode: ${oldStatus.currentMode.toUpperCase()}`,
                            `• Fail Count: ${oldStatus.failCount}`,
                            `• Total Switches: ${oldStatus.totalSwitches}`
                        ].join('\n'))
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_ADMIN] Error resetting fallback: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: '❌ Error resetting fallback system!'
                    });
                }
                break;
            }

            case 'test-user': {
                const username = interaction.options.getString('username');
                
                try {
                    const testStartTime = Date.now();
                    
                    // Update the interaction to show we're testing
                    await interaction.editReply({
                        content: `🔍 Testing Instagram API for **${username}**...\nThis may take up to 30 seconds.`
                    });

                    // Test both modes
                    const puppeteerTest = await this.testMode('puppeteer', username);
                    await instagramApi.delay(2000); // Small delay between tests
                    const rsshubTest = await this.testMode('rsshub', username);
                    
                    const totalTestTime = Date.now() - testStartTime;

                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `Instagram API Test Results` })
                        .setColor(this.getTestResultColor(puppeteerTest, rsshubTest))
                        .setTitle(`🧪 Test Results for ${username}`)
                        .addFields(
                            {
                                name: '🎭 Puppeteer Test',
                                value: [
                                    `**Status:** ${puppeteerTest.success ? '✅ Success' : '❌ Failed'}`,
                                    `**Response Time:** ${puppeteerTest.responseTime}ms`,
                                    `**Error:** ${puppeteerTest.error || 'None'}`
                                ].join('\n'),
                                inline: true
                            },
                            {
                                name: '📡 RSSHub Test',
                                value: [
                                    `**Status:** ${rsshubTest.success ? '✅ Success' : '❌ Failed'}`,
                                    `**Response Time:** ${rsshubTest.responseTime}ms`,
                                    `**Error:** ${rsshubTest.error || 'None'}`
                                ].join('\n'),
                                inline: true
                            },
                            {
                                name: '📋 Recommendation',
                                value: this.getRecommendation(puppeteerTest, rsshubTest),
                                inline: false
                            }
                        )
                        .setFooter({ text: `Total test time: ${totalTestTime}ms` })
                        .setTimestamp();

                    await interaction.editReply({ 
                        content: null, 
                        embeds: [embed] 
                    });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_ADMIN] Error testing user: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: `❌ Error testing **${username}**: ${error.message}`
                    });
                }
                break;
            }
        }
    },

    // Helper method to test a specific mode
    async testMode(mode, username) {
        const startTime = Date.now();
        
        try {
            let result;
            
            if (mode === 'puppeteer') {
                result = await instagramApi.fetchViaPuppeteer(username, true);
            } else if (mode === 'rsshub') {
                result = await instagramApi.fetchViaRSSHub(username);
            }
            
            const responseTime = Date.now() - startTime;
            
            return {
                success: result && result.success,
                responseTime,
                error: result && !result.success ? result.error : null,
                data: result && result.data ? result.data : null
            };
            
        } catch (error) {
            return {
                success: false,
                responseTime: Date.now() - startTime,
                error: error.message,
                data: null
            };
        }
    },

    // Helper method to get status color based on health score
    getStatusColor(healthScore) {
        if (healthScore >= 80) return '#00ff00'; // Green
        if (healthScore >= 60) return '#ffff00'; // Yellow
        if (healthScore >= 40) return '#ff6600'; // Orange
        return '#ff0000'; // Red
    },

    // Helper method to get test result color
    getTestResultColor(puppeteerTest, rsshubTest) {
        if (puppeteerTest.success && rsshubTest.success) return '#00ff00'; // Green - both work
        if (puppeteerTest.success || rsshubTest.success) return '#ffff00'; // Yellow - one works
        return '#ff0000'; // Red - both failed
    },

    // Helper method to generate recommendation based on test results
    getRecommendation(puppeteerTest, rsshubTest) {
        if (puppeteerTest.success && rsshubTest.success) {
            const fasterMode = puppeteerTest.responseTime <= rsshubTest.responseTime ? 'Puppeteer' : 'RSSHub';
            return `✅ Both modes working! ${fasterMode} is faster (${Math.min(puppeteerTest.responseTime, rsshubTest.responseTime)}ms vs ${Math.max(puppeteerTest.responseTime, rsshubTest.responseTime)}ms)`;
        }
        
        if (puppeteerTest.success) {
            return `✅ Use Puppeteer mode - RSSHub is currently failing`;
        }
        
        if (rsshubTest.success) {
            return `⚠️ Use RSSHub mode - Puppeteer is currently failing`;
        }
        
        return `❌ Both modes are failing - check Instagram username or try again later`;
    }
};