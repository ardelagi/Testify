const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const InstagramSchema = require('../../schemas/instaNotificationSystem');
const instagramApi = require('../../api/instagramApi');
const { color, getTimestamp } = require('../../utils/loggingEffects');

module.exports = {
    usableInDms: false,
    category: 'Instagram',
    permissions: [PermissionFlagsBits.ManageGuild],
    data: new SlashCommandBuilder()
        .setName('insta-notification')
        .setDescription('Manage Instagram notifications with advanced fallback system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand => 
            subcommand
                .setName('add-user')
                .setDescription('Add an Instagram user to track')
                .addStringOption(option => 
                    option
                        .setName('username')
                        .setDescription('The Instagram username to track')
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option
                        .setName('channel')
                        .setDescription('The channel to send notifications to')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('delete-user')
                .setDescription('Remove an Instagram user from tracking')
                .addStringOption(option => 
                    option
                        .setName('username')
                        .setDescription('The Instagram username to stop tracking')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('check')
                .setDescription('Check which Instagram users are being tracked')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('force-check')
                .setDescription('Force check for new posts from a specific user')
                .addStringOption(option => 
                    option
                        .setName('username')
                        .setDescription('Instagram username to force check')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('system-info')
                .setDescription('View Instagram API system information and health')
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add-user': {
                const username = interaction.options.getString('username');
                const channel = interaction.options.getChannel('channel');

                try {
                    await interaction.editReply({
                        content: `🔍 Validating Instagram user **${username}**...\nTesting both API modes...`
                    });

                    const isValid = await instagramApi.validateUser(username);
                    if (!isValid) {
                        const embed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('❌ Instagram User Not Found')
                            .setDescription([
                                `The Instagram username '${username}' could not be found or is not accessible.`,
                                '',
                                '**Possible reasons:**',
                                '• Username doesn\'t exist',
                                '• Account is private',
                                '• Account is restricted',
                                '• Instagram is blocking our requests',
                                '',
                                'Please double-check the username and try again!'
                            ].join('\n'))
                            .setTimestamp();

                        return await interaction.editReply({
                            content: null,
                            embeds: [embed]
                        });
                    }

                    let data = await InstagramSchema.findOne({ Guild: interaction.guild.id });
                    
                    if (!data) {
                        data = new InstagramSchema({
                            Guild: interaction.guild.id,
                            Channel: channel.id,
                            InstagramUsers: [username]
                        });
                    } else {
                        if (data.InstagramUsers.includes(username)) {
                            return await interaction.editReply({
                                content: `⚠️ **${username}** is already being tracked!`
                            });
                        }
                        data.InstagramUsers.push(username);
                        data.Channel = channel.id;
                    }

                    await data.save();

                    const currentMode = instagramApi.getCurrentMode(username);
                    const health = instagramApi.getSystemHealth();

                    const embed = new EmbedBuilder()
                        .setAuthor({ 
                            name: `Instagram Notification Tool ${client.config.devBy}`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setColor(client.config.embedInsta)
                        .setTitle(`${client.user.username} Instagram Notification Setup ${client.config.arrowEmoji}`)
                        .setDescription([
                            `✅ **Now tracking posts from:** ${username}`,
                            `📢 **Notifications will be sent to:** ${channel}`,
                            '',
                            `🔧 **API Mode:** ${currentMode.toUpperCase()}`,
                            `💪 **System Health:** ${health.healthScore}%`,
                            '',
                            currentMode === 'rsshub' ? 
                                '⚠️ *Currently using backup mode due to Puppeteer issues*' :
                                '✨ *Using primary Puppeteer mode for best quality*'
                        ].join('\n'))
                        .addFields({
                            name: '📊 Tracking Summary',
                            value: [
                                `**Total Users Tracked:** ${data.InstagramUsers.length}`,
                                `**Channel:** <#${channel.id}>`,
                                `**Check Interval:** Every 15 minutes`
                            ].join('\n'),
                            inline: false
                        })
                        .setFooter({ text: `User added successfully • ${data.InstagramUsers.length} total users` })
                        .setTimestamp();

                    await interaction.editReply({ 
                        content: null,
                        embeds: [embed] 
                    });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_NOTIFICATION] Error while setting up instagram notifications: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: '❌ There was an error while setting up the Instagram notifications!'
                    });
                }
                break;
            }

            case 'delete-user': {
                const username = interaction.options.getString('username');

                try {
                    const data = await InstagramSchema.findOne({ Guild: interaction.guild.id });

                    if (!data || !data.InstagramUsers.includes(username)) {
                        return await interaction.editReply({
                            content: `⚠️ **${username}** is not being tracked! Double check the username and try again.`
                        });
                    }

                    data.InstagramUsers = data.InstagramUsers.filter(user => user !== username);
                    
                    data.deleteLastPostDate(username);
                    
                    await data.save();

                    instagramApi.fallbackSystem.userSpecificModes.delete(username);

                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `Instagram Notification Tool ${client.config.devBy}` })
                        .setColor('#ff6600')
                        .setTitle(`${client.user.username} Instagram Notification Removed ${client.config.arrowEmoji}`)
                        .setDescription([
                            `🗑️ **Stopped tracking posts from:** ${username}`,
                            '',
                            `📊 **Remaining tracked users:** ${data.InstagramUsers.length}`,
                            data.InstagramUsers.length > 0 ? 
                                `📋 **Still tracking:** ${data.InstagramUsers.slice(0, 5).join(', ')}${data.InstagramUsers.length > 5 ? '...' : ''}` :
                                '📋 **No users currently tracked**'
                        ].join('\n'))
                        .setFooter({ text: `User removed successfully • ${data.InstagramUsers.length} users remaining`})
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_NOTIFICATION] Error while removing instagram notifications: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: '❌ There was an error while removing the Instagram notifications!'
                    });
                }
                break;
            }

            case 'check': {
                try {
                    const data = await InstagramSchema.findOne({ Guild: interaction.guild.id });

                    if (!data || data.InstagramUsers.length === 0) {
                        const embed = new EmbedBuilder()
                            .setColor('#ffaa00')
                            .setTitle('📋 No Instagram Users Tracked')
                            .setDescription([
                                'No Instagram users are being tracked in this server!',
                                '',
                                'Use `/insta-notification add-user` to start tracking Instagram accounts.'
                            ].join('\n'))
                            .setTimestamp();

                        return await interaction.editReply({ embeds: [embed] });
                    }

                    const health = instagramApi.getSystemHealth();
                    const status = instagramApi.getFallbackStatus();

                    const userList = data.InstagramUsers.map(user => {
                        const userMode = instagramApi.getCurrentMode(user);
                        const modeEmoji = userMode === 'puppeteer' ? '🎭' : '📡';
                        return `${modeEmoji} **${user}** (${userMode})`;
                    }).join('\n');

                    const embed = new EmbedBuilder()
                        .setAuthor({ 
                            name: `Instagram Notification Tool ${client.config.devBy}`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setColor(client.config.embedInsta)
                        .setTitle(`${client.user.username} Instagram Tracking Status ${client.config.arrowEmoji}`)
                        .setDescription([
                            `📊 **System Health:** ${health.healthScore}% ${this.getHealthEmoji(health.healthScore)}`,
                            `🔧 **Primary Mode:** ${status.currentMode.toUpperCase()}`,
                            `📢 **Notification Channel:** <#${data.Channel}>`,
                            '',
                            '**Tracked Users:**',
                            userList
                        ].join('\n'))
                        .addFields(
                            {
                                name: '⚡ Performance Stats',
                                value: [
                                    `**Success Rate:**`,
                                    `• Puppeteer: ${this.calculateSuccessRate(status.stats.puppeteer)}%`,
                                    `• RSSHub: ${this.calculateSuccessRate(status.stats.rsshub)}%`,
                                    `**Total Requests:** ${status.stats.puppeteer.success + status.stats.puppeteer.failures + status.stats.rsshub.success + status.stats.rsshub.failures}`
                                ].join('\n'),
                                inline: true
                            },
                            {
                                name: '🔄 Fallback Info',
                                value: [
                                    `**Mode Switches:** ${status.totalSwitches}`,
                                    `**Current Failures:** ${status.failCount}/${instagramApi.fallbackConfig.MAX_FAIL_COUNT}`,
                                    status.cooldownRemaining > 0 ? 
                                        `**Recovery In:** ${Math.ceil(status.cooldownRemaining / 60000)}min` :
                                        `**Status:** Ready for recovery`
                                ].join('\n'),
                                inline: true
                            }
                        )
                        .setFooter({ text: `Tracking ${data.InstagramUsers.length} Instagram users • Check interval: 15 minutes` })
                        .setTimestamp();

                    if (health.healthScore < 70) {
                        embed.addFields({
                            name: '⚠️ System Warning',
                            value: `Health score is below 70%. Consider using \`/insta-admin reset-fallback\` if issues persist.`,
                            inline: false
                        });
                    }

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_NOTIFICATION] Error while checking instagram notifications: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: '❌ There was an error while checking Instagram notifications!'
                    });
                }
                break;
            }

            case 'force-check': {
                const username = interaction.options.getString('username');

                try {
                    const data = await InstagramSchema.findOne({ Guild: interaction.guild.id });

                    if (!data || !data.InstagramUsers.includes(username)) {
                        return await interaction.editReply({
                            content: `❌ **${username}** is not being tracked in this server!`
                        });
                    }

                    await interaction.editReply({
                        content: `🔍 Force checking **${username}** for new posts...\nThis may take up to 30 seconds.`
                    });

                    const currentMode = instagramApi.getCurrentMode(username);
                    const startTime = Date.now();
                    
                    const latestPost = await instagramApi.getLatestPost(username);
                    const checkTime = Date.now() - startTime;

                    if (latestPost) {
                        const lastPostTime = new Date(latestPost.taken_at_timestamp * 1000);
                        
                        const lastChecked = data.getLastPostDate(username);
                        const isNewPost = !lastChecked || lastPostTime > lastChecked;

                        const embed = new EmbedBuilder()
                            .setAuthor({ 
                                name: `Force Check Results`,
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setColor(isNewPost ? '#00ff00' : '#ffaa00')
                            .setTitle(`📱 Latest Post from ${username}`)
                            .setDescription([
                                `✅ **Status:** Post found successfully`,
                                `🔧 **API Mode:** ${latestPost.source?.toUpperCase() || currentMode.toUpperCase()}`,
                                `⏱️ **Response Time:** ${checkTime}ms`,
                                `🆕 **New Post:** ${isNewPost ? 'Yes' : 'No'}`,
                                '',
                                `**Caption:** ${latestPost.caption || 'No caption'}`,
                                `**Posted:** <t:${latestPost.taken_at_timestamp}:R>`
                            ].join('\n'))
                            .setFooter({ 
                                text: `Force check completed • ${isNewPost ? 'New post detected' : 'No new posts'}`
                            })
                            .setTimestamp();

                        if (latestPost.display_url) {
                            embed.setImage(latestPost.display_url);
                        }

                        if (latestPost.shortcode) {
                            embed.setURL(`https://www.instagram.com/p/${latestPost.shortcode}`);
                        }

                        await interaction.editReply({ 
                            content: null,
                            embeds: [embed] 
                        });

                        if (isNewPost) {
                            data.setLastPostDate(username, lastPostTime);
                            await data.save();
                        }

                    } else {
                        const health = instagramApi.getSystemHealth();
                        
                        const embed = new EmbedBuilder()
                            .setColor('#ff6600')
                            .setTitle(`⚠️ No Posts Retrieved`)
                            .setDescription([
                                `Could not retrieve posts from **${username}**`,
                                '',
                                `🔧 **Current Mode:** ${currentMode.toUpperCase()}`,
                                `💪 **System Health:** ${health.healthScore}%`,
                                `⏱️ **Check Time:** ${checkTime}ms`,
                                '',
                                '**Possible reasons:**',
                                '• No recent posts available',
                                '• Account is private or restricted',
                                '• API rate limiting',
                                '• Temporary Instagram issues',
                                '',
                                health.healthScore < 70 ? 
                                    '💡 *System health is low - automatic recovery may be in progress*' :
                                    '💡 *Try again in a few minutes*'
                            ].join('\n'))
                            .setTimestamp();

                        await interaction.editReply({ 
                            content: null,
                            embeds: [embed] 
                        });
                    }

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_FORCE_CHECK] Error during force check: ${error.message}${color.reset}`);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ Force Check Failed')
                        .setDescription([
                            `Error while checking **${username}**:`,
                            `\`${error.message}\``,
                            '',
                            '💡 The system will automatically attempt different methods during the next scheduled check.'
                        ].join('\n'))
                        .setTimestamp();

                    await interaction.editReply({ 
                        content: null,
                        embeds: [embed] 
                    });
                }
                break;
            }

            case 'system-info': {
                try {
                    const health = instagramApi.getSystemHealth();
                    const status = instagramApi.getFallbackStatus();
                    const data = await InstagramSchema.findOne({ Guild: interaction.guild.id });

                    const embed = new EmbedBuilder()
                        .setAuthor({ 
                            name: `Instagram API System Information`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setColor(this.getSystemColor(health.healthScore))
                        .setTitle(`🔧 System Status & Performance`)
                        .addFields(
                            {
                                name: '📈 Overall Health',
                                value: [
                                    `**Health Score:** ${health.healthScore}% ${this.getHealthEmoji(health.healthScore)}`,
                                    `**Primary Mode:** ${status.currentMode.toUpperCase()}`,
                                    `**Puppeteer Status:** ${health.isPuppeteerActive ? 'Active ✅' : 'Inactive ❌'}`,
                                    `**Users in Server:** ${data ? data.InstagramUsers.length : 0}`
                                ].join('\n'),
                                inline: false
                            },
                            {
                                name: '📊 Performance Metrics',
                                value: [
                                    `**Puppeteer:**`,
                                    `  • Success: ${status.stats.puppeteer.success}`,
                                    `  • Failures: ${status.stats.puppeteer.failures}`,
                                    `  • Avg Response: ${health.avgResponseTime.puppeteer}ms`,
                                    `**RSSHub:**`,
                                    `  • Success: ${status.stats.rsshub.success}`,
                                    `  • Failures: ${status.stats.rsshub.failures}`,
                                    `  • Avg Response: ${health.avgResponseTime.rsshub}ms`
                                ].join('\n'),
                                inline: true
                            },
                            {
                                name: '🔄 Fallback Statistics',
                                value: [
                                    `**Current Failures:** ${status.failCount}/${instagramApi.fallbackConfig.MAX_FAIL_COUNT}`,
                                    `**Total Switches:** ${status.totalSwitches}`,
                                    `**Recovery Attempts:** ${status.stats.recoveryAttempts}`,
                                    status.cooldownRemaining > 0 ? 
                                        `**Recovery Cooldown:** ${Math.ceil(status.cooldownRemaining / 60000)}min` :
                                        `**Recovery Status:** Ready`
                                ].join('\n'),
                                inline: true
                            }
                        )
                        .setFooter({ text: 'Use /insta-admin for advanced management options' })
                        .setTimestamp();

                    // Add performance recommendations
                    const recommendations = this.getPerformanceRecommendations(health, status);
                    if (recommendations.length > 0) {
                        embed.addFields({
                            name: '💡 Recommendations',
                            value: recommendations.join('\n'),
                            inline: false
                        });
                    }

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_SYSTEM_INFO] Error getting system info: ${error.message}${color.reset}`);
                    await interaction.editReply({
                        content: '❌ Error retrieving system information!'
                    });
                }
                break;
            }
        }
    },

    // Helper methods
    getHealthEmoji(healthScore) {
        if (healthScore >= 90) return '🟢';
        if (healthScore >= 70) return '🟡';
        if (healthScore >= 50) return '🟠';
        return '🔴';
    },

    getSystemColor(healthScore) {
        if (healthScore >= 80) return '#00ff00';
        if (healthScore >= 60) return '#ffff00';
        if (healthScore >= 40) return '#ff6600';
        return '#ff0000';
    },

    calculateSuccessRate(stats) {
        const total = stats.success + stats.failures;
        return total > 0 ? Math.round((stats.success / total) * 100) : 0;
    },

    getPerformanceRecommendations(health, status) {
        const recommendations = [];

        if (health.healthScore < 50) {
            recommendations.push('🔴 Consider resetting the fallback system with `/insta-admin reset-fallback`');
        }

        if (status.stats.puppeteer.failures > status.stats.puppeteer.success && status.currentMode === 'puppeteer') {
            recommendations.push('⚠️ Puppeteer is failing frequently - system may auto-switch to RSSHub');
        }

        if (!health.isPuppeteerActive && status.currentMode === 'puppeteer') {
            recommendations.push('💡 Puppeteer cluster is not active - it will initialize when needed');
        }

        if (health.avgResponseTime.puppeteer > 20000) {
            recommendations.push('🐌 Puppeteer response times are high - consider switching to RSSHub temporarily');
        }

        return recommendations;
    }
};