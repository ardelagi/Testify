const { Events, EmbedBuilder } = require('discord.js');
const InstagramSchema = require('../../schemas/instaNotificationSystem');
const instagramApi = require('../../api/instagramApi');
const { color, getTimestamp } = require('../../utils/loggingEffects');

module.exports = {
    name: Events.ClientReady,
    async execute(client) {
        let lastRoutineLog = 0;
        let lastHealthCheck = 0;
        
        const checkInstagramPosts = async () => {
            try {
                const allGuilds = await InstagramSchema.find();
                
                const now = Date.now();
                if (now - lastRoutineLog > 6 * 60 * 60 * 1000) {
                    const health = instagramApi.getSystemHealth();
                    console.log(`${color.cyan}[${getTimestamp()}] [INSTA_ROUTINE] Health check - Mode: ${health.currentMode}, Score: ${health.healthScore}%${color.reset}`);
                    lastRoutineLog = now;
                }

                // Periodic health monitoring
                if (now - lastHealthCheck > 30 * 60 * 1000) { // Every 30 minutes
                    await this.performHealthCheck();
                    lastHealthCheck = now;
                }

                for (const guildData of allGuilds) {
                    const processedUsers = new Set();
                    
                    for (const username of guildData.InstagramUsers) {
                        // Skip if already processed (avoid duplicates)
                        if (processedUsers.has(username)) continue;
                        processedUsers.add(username);
                        
                        try {
                            // Smart delay based on current mode
                            const currentMode = instagramApi.getCurrentMode(username);
                            const delayTime = currentMode === 'puppeteer' ? 5000 : 3000; // Longer delay for Puppeteer
                            
                            await instagramApi.delay(delayTime);
                            
                            console.log(`${color.blue}[${getTimestamp()}] [INSTA_CHECK] Checking ${username} (mode: ${currentMode})${color.reset}`);
                            
                            const latestPost = await instagramApi.getLatestPost(username);
                            
                            if (latestPost) {
                                const lastPostTime = new Date(latestPost.taken_at_timestamp * 1000);
                                const lastChecked = guildData.LastPostDates.get(username);

                                if (!lastChecked || lastPostTime > lastChecked) {
                                    const channel = client.channels.cache.get(guildData.Channel);
                                    if (channel) {
                                        // Enhanced embed with source information
                                        const embed = new EmbedBuilder()
                                            .setAuthor({ 
                                                name: `${client.user.username} Instagram Post Tracker`, 
                                                iconURL: client.user.displayAvatarURL() 
                                            })
                                            .setColor(this.getEmbedColor(latestPost.source))
                                            .setTitle(`New Post from ${username}`)
                                            .setDescription(latestPost.caption || 'No caption')
                                            .setURL(`https://www.instagram.com/p/${latestPost.shortcode}`)
                                            .setTimestamp(lastPostTime)
                                            .setFooter({ 
                                                text: `Posted on Instagram • Source: ${latestPost.source?.toUpperCase() || 'API'}`
                                            });

                                        // Add image if available
                                        if (latestPost.display_url) {
                                            embed.setImage(latestPost.display_url);
                                        }

                                        await channel.send({ embeds: [embed] });

                                        // Update database
                                        guildData.LastPostDates.set(username, lastPostTime);
                                        await guildData.save();

                                        console.log(`${color.green}[${getTimestamp()}] [INSTA_NOTIFICATION] New post detected for ${username} via ${latestPost.source}${color.reset}`);
                                    }
                                }
                            } else {
                                // Log failed fetch attempts with mode context
                                const currentMode = instagramApi.getCurrentMode(username);
                                if (instagramApi.logRateLimiter.shouldLog(`fetch_failed_${username}`, 120)) {
                                    console.warn(`${color.yellow}[${getTimestamp()}] [INSTA_CHECK] No data retrieved for ${username} (mode: ${currentMode})${color.reset}`);
                                }
                            }
                            
                        } catch (error) {
                            // Enhanced error logging with fallback context
                            const currentMode = instagramApi.getCurrentMode(username);
                            if (instagramApi.logRateLimiter.shouldLog(`error_${username}`, 60)) {
                                console.error(`${color.red}[${getTimestamp()}] [INSTA_ERROR] Error checking ${username} (mode: ${currentMode}): ${error.message}${color.reset}`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`${color.red}[${getTimestamp()}] [INSTA_NOTIFICATION] Error in post checking routine: ${color.reset}`, error);
            }
        };

        // Health check method
        this.performHealthCheck = async () => {
            try {
                const health = instagramApi.getSystemHealth();
                
                // Log warnings for poor performance
                if (health.healthScore < 70) {
                    console.warn(`${color.yellow}[${getTimestamp()}] [HEALTH_CHECK] Low health score: ${health.healthScore}%${color.reset}`);
                }
                
                // Log mode distribution
                const puppeteerUsers = Array.from(instagramApi.fallbackSystem.userSpecificModes.entries())
                    .filter(([_, mode]) => mode === 'puppeteer').length;
                const rsshubUsers = Array.from(instagramApi.fallbackSystem.userSpecificModes.entries())
                    .filter(([_, mode]) => mode === 'rsshub').length;
                
                if (instagramApi.logRateLimiter.shouldLog('health_detailed', 120)) {
                    console.log(`${color.cyan}[${getTimestamp()}] [HEALTH] Puppeteer: ${puppeteerUsers} users, RSSHub: ${rsshubUsers} users${color.reset}`);
                }
                
                // Clean up unused Puppeteer cluster if all users are on RSSHub
                if (health.currentMode === 'rsshub' && puppeteerUsers === 0 && health.isPuppeteerActive) {
                    console.log(`${color.yellow}[${getTimestamp()}] [OPTIMIZATION] All users on RSSHub, closing Puppeteer cluster${color.reset}`);
                    await instagramApi.closePuppeteerCluster();
                }
                
            } catch (error) {
                console.error(`${color.red}[${getTimestamp()}] [HEALTH_CHECK] Error during health check: ${error.message}${color.reset}`);
            }
        };

        // Get embed color based on source
        this.getEmbedColor = (source) => {
            switch (source) {
                case 'puppeteer': return '#E1306C'; // Instagram pink
                case 'rsshub': return '#FF6B35'; // Orange for RSSHub
                default: return client.config.embedInsta || '#E1306C';
            }
        };

        // Start the monitoring interval
        setInterval(checkInstagramPosts, 15 * 60 * 1000); // Every 15 minutes

        // Initial check after 1 minute
        setTimeout(() => {
            checkInstagramPosts();
        }, 60000);

        // Setup graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`${color.yellow}[${getTimestamp()}] [SHUTDOWN] Received ${signal}, performing cleanup...${color.reset}`);
            
            try {
                await instagramApi.cleanup();
                console.log(`${color.green}[${getTimestamp()}] [SHUTDOWN] Cleanup completed${color.reset}`);
            } catch (error) {
                console.error(`${color.red}[${getTimestamp()}] [SHUTDOWN] Error during cleanup: ${error.message}${color.reset}`);
            }
            
            process.exit(0);
        };

        // Register shutdown handlers
        process.once('SIGINT', () => gracefulShutdown('SIGINT'));
        process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

        console.log(`${color.green}[${getTimestamp()}] [INSTA_NOTIFICATION] Enhanced Instagram notification system started${color.reset}`);
        console.log(`${color.blue}[${getTimestamp()}] [INSTA_NOTIFICATION] Fallback system active - Primary: Puppeteer, Backup: RSSHub${color.reset}`);
    }
};