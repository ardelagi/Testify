const fetch = require('node-fetch');
const { color, getTimestamp } = require('../utils/loggingEffects');

class InstagramAPI {
    constructor() {
        // Original properties
        this.USER_AGENTS = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:111.0) Gecko/20100101 Firefox/111.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:111.0) Gecko/20100101 Firefox/111.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/122.0.2365.92',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        ];

        this.IG_APP_ID = '936619743392459';

        // Enhanced Fallback System Configuration
        this.fallbackConfig = {
            RETRY_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
            MAX_FAIL_COUNT: 3,
            PUPPETEER_TIMEOUT: 30000, // 30 seconds timeout for Puppeteer
            RSSHUB_TIMEOUT: 15000, // 15 seconds timeout for RSSHub
            COOLDOWN_MULTIPLIER: 2, // Exponential backoff multiplier
            MAX_COOLDOWN: 6 * 60 * 60 * 1000 // Maximum 6 hours cooldown
        };

        // Fallback System State
        this.fallbackSystem = {
            mode: 'puppeteer', // 'puppeteer' | 'rsshub'
            failCount: 0,
            lastFailureTime: 0,
            cooldownUntil: 0,
            totalSwitches: 0,
            modeHistory: [],
            userSpecificModes: new Map(), // Track mode per user
            
            // Statistics tracking
            stats: {
                puppeteer: { success: 0, failures: 0, totalTime: 0 },
                rsshub: { success: 0, failures: 0, totalTime: 0 },
                fallbacksTriggered: 0,
                recoveryAttempts: 0
            }
        };

        // Original properties (keeping existing functionality)
        this.browserSignatures = [
            {
                appId: this.IG_APP_ID,
                deviceId: this.generateUUID(),
                asbdId: '198387',
                csrfToken: this.generateRandomString(32),
            },
            {
                appId: this.IG_APP_ID,
                deviceId: this.generateUUID(),
                asbdId: '198387',
                csrfToken: this.generateRandomString(32),
            },
        ];

        this.sessionManager = {
            cookies: {},
            lastRefresh: {},
            activeSignatures: {},
            
            getCookies: (username) => {
                const now = Date.now();
                if (!this.sessionManager.cookies[username] || now - (this.sessionManager.lastRefresh[username] || 0) > 3 * 60 * 60 * 1000) {
                    if (!this.sessionManager.activeSignatures[username]) {
                        this.sessionManager.activeSignatures[username] = this.browserSignatures[Math.floor(Math.random() * this.browserSignatures.length)];
                    }
                    
                    this.sessionManager.cookies[username] = this.generateRealisticCookies(this.sessionManager.activeSignatures[username]);
                    this.sessionManager.lastRefresh[username] = now;
                }
                return this.sessionManager.cookies[username];
            },
            
            refreshCookie: (username) => {
                delete this.sessionManager.cookies[username];
                delete this.sessionManager.lastRefresh[username];
                
                const otherSignatures = this.browserSignatures.filter(sig => 
                    sig.deviceId !== this.sessionManager.activeSignatures[username]?.deviceId
                );
                
                if (otherSignatures.length > 0) {
                    this.sessionManager.activeSignatures[username] = otherSignatures[Math.floor(Math.random() * otherSignatures.length)];
                } else {
                    this.sessionManager.activeSignatures[username] = {
                        appId: this.IG_APP_ID,
                        deviceId: this.generateUUID(),
                        asbdId: '198387',
                        csrfToken: this.generateRandomString(32),
                    };
                }
                
                return this.sessionManager.getCookies(username);
            }
        };

        this.rateLimiter = {
            calls: {},
            lastWarning: {},
            
            checkLimit: (username) => {
                const now = Date.now();
                if (!this.rateLimiter.calls[username]) {
                    this.rateLimiter.calls[username] = [];
                }
        
                this.rateLimiter.calls[username] = this.rateLimiter.calls[username].filter(time => now - time < 15 * 60 * 1000);
                if (this.rateLimiter.calls[username].length >= 10) {
                    const lastWarningTime = this.rateLimiter.lastWarning[username] || 0;
                    if (now - lastWarningTime > 30 * 60 * 1000) {
                        console.warn(`${color.yellow}[${getTimestamp()}] [INSTA_API] Rate limiting API calls for ${username}${color.reset}`);
                        this.rateLimiter.lastWarning[username] = now;
                    }
                    return false;
                }
                this.rateLimiter.calls[username].push(now);
                return true;
            }
        };

        this.logRateLimiter = {
            lastLogs: {},
            
            shouldLog: (key, minutes = 30) => {
                const now = Date.now();
                const lastLog = this.logRateLimiter.lastLogs[key] || 0;
                
                if (now - lastLog > minutes * 60 * 1000) {
                    this.logRateLimiter.lastLogs[key] = now;
                    return true;
                }
                return false;
            }
        };

        this.authStrategies = {
            success: {},
            failures: {}
        };

        // Initialize Puppeteer cluster (will be set up later)
        this.puppeteerCluster = null;
        this.isPuppeteerInitialized = false;
    }

    // ===== FALLBACK SYSTEM METHODS =====

    /**
     * Check if we should attempt recovery from RSSHub back to Puppeteer
     */
    shouldAttemptRecovery() {
        const now = Date.now();
        return (
            this.fallbackSystem.mode === 'rsshub' &&
            now > this.fallbackSystem.cooldownUntil &&
            now - this.fallbackSystem.lastFailureTime > this.fallbackConfig.RETRY_INTERVAL
        );
    }

    /**
     * Switch to fallback mode (RSSHub) when Puppeteer fails
     */
    async switchToFallback(username, error) {
        const now = Date.now();
        
        this.fallbackSystem.failCount++;
        this.fallbackSystem.lastFailureTime = now;
        
        if (this.fallbackSystem.failCount >= this.fallbackConfig.MAX_FAIL_COUNT) {
            this.fallbackSystem.mode = 'rsshub';
            this.fallbackSystem.totalSwitches++;
            this.fallbackSystem.stats.fallbacksTriggered++;
            
            // Calculate exponential cooldown
            const baseCooldown = this.fallbackConfig.RETRY_INTERVAL;
            const exponentialCooldown = Math.min(
                baseCooldown * Math.pow(this.fallbackConfig.COOLDOWN_MULTIPLIER, Math.floor(this.fallbackSystem.totalSwitches / 3)),
                this.fallbackConfig.MAX_COOLDOWN
            );
            
            this.fallbackSystem.cooldownUntil = now + exponentialCooldown;
            
            // Log fallback switch
            console.warn(`${color.red}[${getTimestamp()}] [FALLBACK] Switching to RSSHub mode for ${username}${color.reset}`);
            console.warn(`${color.yellow}[${getTimestamp()}] [FALLBACK] Puppeteer will retry in ${Math.round(exponentialCooldown / 60000)} minutes${color.reset}`);
            
            // Add to mode history
            this.fallbackSystem.modeHistory.push({
                mode: 'rsshub',
                timestamp: now,
                reason: `puppeteer_failed_${this.fallbackSystem.failCount}x`,
                error: error?.message || 'Unknown error'
            });
            
            // Set user-specific mode
            this.fallbackSystem.userSpecificModes.set(username, 'rsshub');
        }
    }

    /**
     * Attempt recovery to Puppeteer mode
     */
    async attemptRecovery(username) {
        if (!this.shouldAttemptRecovery()) {
            return false;
        }

        console.log(`${color.blue}[${getTimestamp()}] [RECOVERY] Attempting to switch back to Puppeteer mode for ${username}${color.reset}`);
        
        this.fallbackSystem.stats.recoveryAttempts++;
        
        try {
            // Test Puppeteer with a simple operation
            const testResult = await this.fetchViaPuppeteer(username, true);
            
            if (testResult && testResult.success) {
                // Recovery successful
                this.fallbackSystem.mode = 'puppeteer';
                this.fallbackSystem.failCount = 0;
                this.fallbackSystem.cooldownUntil = 0;
                this.fallbackSystem.userSpecificModes.set(username, 'puppeteer');
                
                console.log(`${color.green}[${getTimestamp()}] [RECOVERY] Successfully switched back to Puppeteer mode for ${username}${color.reset}`);
                
                // Add to mode history
                this.fallbackSystem.modeHistory.push({
                    mode: 'puppeteer',
                    timestamp: Date.now(),
                    reason: 'successful_recovery',
                    error: null
                });
                
                return true;
            }
        } catch (error) {
            console.warn(`${color.yellow}[${getTimestamp()}] [RECOVERY] Recovery attempt failed for ${username}: ${error.message}${color.reset}`);
        }
        
        return false;
    }

    /**
     * Get current mode for a specific user
     */
    getCurrentMode(username) {
        const userMode = this.fallbackSystem.userSpecificModes.get(username);
        return userMode || this.fallbackSystem.mode;
    }

    /**
     * Get fallback system status
     */
    getFallbackStatus() {
        return {
            currentMode: this.fallbackSystem.mode,
            failCount: this.fallbackSystem.failCount,
            totalSwitches: this.fallbackSystem.totalSwitches,
            cooldownUntil: this.fallbackSystem.cooldownUntil,
            cooldownRemaining: Math.max(0, this.fallbackSystem.cooldownUntil - Date.now()),
            stats: { ...this.fallbackSystem.stats },
            recentHistory: this.fallbackSystem.modeHistory.slice(-5) // Last 5 mode changes
        };
    }

    // ===== PUPPETEER METHODS =====

    /**
     * Initialize Puppeteer cluster
     */
    async initializePuppeteerCluster() {
        if (this.isPuppeteerInitialized) {
            return true;
        }

        try {
            const { Cluster } = require('puppeteer-cluster');
            
            this.puppeteerCluster = await Cluster.launch({
                concurrency: Cluster.CONCURRENCY_CONTEXT,
                maxConcurrency: 2,
                puppeteerOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                },
                timeout: this.fallbackConfig.PUPPETEER_TIMEOUT,
                retryLimit: 0,
                skipDuplicateUrls: true
            });

            // Set up the task for scraping Instagram
            await this.puppeteerCluster.task(async ({ page, data: { username, isTest } }) => {
                const startTime = Date.now();
                
                try {
                    await page.setUserAgent(this.getRandomUserAgent());
                    await page.goto(`https://www.instagram.com/${username}/`, {
                        waitUntil: 'networkidle2',
                        timeout: this.fallbackConfig.PUPPETEER_TIMEOUT
                    });

                    // If this is just a test, return success
                    if (isTest) {
                        return { success: true, responseTime: Date.now() - startTime };
                    }

                    // Wait for posts to load
                    await page.waitForSelector('article', { timeout: 10000 });

                    // Extract latest post data
                    const postData = await page.evaluate(() => {
                        const articles = document.querySelectorAll('article');
                        if (articles.length === 0) return null;

                        const firstPost = articles[0];
                        const imageElement = firstPost.querySelector('img');
                        const linkElement = firstPost.querySelector('a[href*="/p/"]');
                        const timeElement = firstPost.querySelector('time');

                        return {
                            imageUrl: imageElement?.src || null,
                            postUrl: linkElement?.href || null,
                            timestamp: timeElement?.getAttribute('datetime') || null,
                            caption: imageElement?.alt || 'No caption available'
                        };
                    });

                    const responseTime = Date.now() - startTime;
                    this.fallbackSystem.stats.puppeteer.totalTime += responseTime;

                    if (postData && postData.postUrl) {
                        return {
                            success: true,
                            data: postData,
                            responseTime,
                            source: 'puppeteer'
                        };
                    }

                    return { success: false, error: 'No post data found', responseTime };

                } catch (error) {
                    const responseTime = Date.now() - startTime;
                    return {
                        success: false,
                        error: error.message,
                        responseTime
                    };
                }
            });

            this.isPuppeteerInitialized = true;
            console.log(`${color.green}[${getTimestamp()}] [PUPPETEER] Cluster initialized successfully${color.reset}`);
            return true;

        } catch (error) {
            console.error(`${color.red}[${getTimestamp()}] [PUPPETEER] Failed to initialize cluster: ${error.message}${color.reset}`);
            return false;
        }
    }

    /**
     * Fetch Instagram data via Puppeteer
     */
    async fetchViaPuppeteer(username, isTest = false) {
        try {
            if (!this.isPuppeteerInitialized) {
                const initialized = await this.initializePuppeteerCluster();
                if (!initialized) {
                    throw new Error('Failed to initialize Puppeteer cluster');
                }
            }

            const result = await this.puppeteerCluster.execute({ username, isTest });
            
            if (result.success) {
                this.fallbackSystem.stats.puppeteer.success++;
                return result;
            } else {
                this.fallbackSystem.stats.puppeteer.failures++;
                throw new Error(result.error || 'Puppeteer scraping failed');
            }

        } catch (error) {
            this.fallbackSystem.stats.puppeteer.failures++;
            throw error;
        }
    }

    /**
     * Close Puppeteer cluster to save resources
     */
    async closePuppeteerCluster() {
        if (this.puppeteerCluster && this.isPuppeteerInitialized) {
            try {
                await this.puppeteerCluster.close();
                this.isPuppeteerInitialized = false;
                this.puppeteerCluster = null;
                console.log(`${color.yellow}[${getTimestamp()}] [PUPPETEER] Cluster closed to save resources${color.reset}`);
            } catch (error) {
                console.error(`${color.red}[${getTimestamp()}] [PUPPETEER] Error closing cluster: ${error.message}${color.reset}`);
            }
        }
    }

    // ===== RSSHUB METHODS =====

    /**
     * Fetch Instagram data via RSSHub
     */
    async fetchViaRSSHub(username) {
        const startTime = Date.now();
        
        try {
            const rssUrl = `https://rsshub.app/instagram/user/${encodeURIComponent(username)}`;
            
            const response = await fetch(rssUrl, {
                timeout: this.fallbackConfig.RSSHUB_TIMEOUT,
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                }
            });

            if (!response.ok) {
                throw new Error(`RSSHub returned ${response.status}: ${response.statusText}`);
            }

            const rssText = await response.text();
            const postData = this.parseRSSFeed(rssText);
            
            const responseTime = Date.now() - startTime;
            this.fallbackSystem.stats.rsshub.totalTime += responseTime;
            this.fallbackSystem.stats.rsshub.success++;

            return {
                success: true,
                data: postData,
                responseTime,
                source: 'rsshub'
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.fallbackSystem.stats.rsshub.failures++;
            throw new Error(`RSSHub failed: ${error.message}`);
        }
    }

    /**
     * Parse RSS feed to extract Instagram post data
     */
    parseRSSFeed(rssText) {
        try {
            // Simple RSS parsing for latest item
            const itemMatch = rssText.match(/<item[^>]*>(.*?)<\/item>/s);
            if (!itemMatch) return null;

            const item = itemMatch[1];
            
            // Extract data using regex (basic RSS parsing)
            const titleMatch = item.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/s);
            const linkMatch = item.match(/<link[^>]*>(.*?)<\/link>/s);
            const pubDateMatch = item.match(/<pubDate[^>]*>(.*?)<\/pubDate>/s);
            const descMatch = item.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>/s);
            
            // Extract image URL from description if available
            const imageMatch = descMatch ? descMatch[1].match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i) : null;

            return {
                caption: titleMatch ? titleMatch[1].trim() : 'No caption available',
                postUrl: linkMatch ? linkMatch[1].trim() : null,
                imageUrl: imageMatch ? imageMatch[1] : null,
                timestamp: pubDateMatch ? new Date(pubDateMatch[1].trim()).getTime() / 1000 : Date.now() / 1000
            };

        } catch (error) {
            console.error(`${color.red}[${getTimestamp()}] [RSSHUB] Error parsing RSS feed: ${error.message}${color.reset}`);
            return null;
        }
    }

    // ===== ENHANCED MAIN METHODS =====

    /**
     * Main method to get latest post with intelligent fallback
     */
    async getLatestPost(username) {
        if (!this.rateLimiter.checkLimit(username)) {
            return null;
        }

        const currentMode = this.getCurrentMode(username);
        
        // Attempt recovery if conditions are met
        if (currentMode === 'rsshub' && this.shouldAttemptRecovery()) {
            const recovered = await this.attemptRecovery(username);
            if (recovered) {
                // If recovery successful, continue with Puppeteer
                return await this.fetchLatestPostWithFallback(username, 'puppeteer');
            }
        }

        return await this.fetchLatestPostWithFallback(username, currentMode);
    }

    /**
     * Fetch latest post with automatic fallback handling
     */
    async fetchLatestPostWithFallback(username, preferredMode = null) {
        const mode = preferredMode || this.getCurrentMode(username);
        const startTime = Date.now();

        try {
            let result;

            if (mode === 'puppeteer') {
                console.log(`${color.blue}[${getTimestamp()}] [INSTA_API] Fetching ${username} via Puppeteer${color.reset}`);
                result = await this.fetchViaPuppeteer(username);
            } else {
                console.log(`${color.cyan}[${getTimestamp()}] [INSTA_API] Fetching ${username} via RSSHub${color.reset}`);
                result = await this.fetchViaRSSHub(username);
            }

            if (result && result.success) {
                // Success - reset fail count if we're back to puppeteer
                if (mode === 'puppeteer') {
                    this.fallbackSystem.failCount = 0;
                }

                // Convert data to standard format
                return this.normalizePostData(result.data, result.source);
            }

            throw new Error(`${mode} returned unsuccessful result`);

        } catch (error) {
            console.error(`${color.red}[${getTimestamp()}] [INSTA_API] ${mode} failed for ${username}: ${error.message}${color.reset}`);

            // Handle failure based on current mode
            if (mode === 'puppeteer') {
                await this.switchToFallback(username, error);
                
                // If we just switched to fallback, try RSSHub immediately
                if (this.getCurrentMode(username) === 'rsshub') {
                    try {
                        console.log(`${color.yellow}[${getTimestamp()}] [FALLBACK] Attempting immediate RSSHub fallback for ${username}${color.reset}`);
                        const fallbackResult = await this.fetchViaRSSHub(username);
                        
                        if (fallbackResult && fallbackResult.success) {
                            return this.normalizePostData(fallbackResult.data, fallbackResult.source);
                        }
                    } catch (fallbackError) {
                        console.error(`${color.red}[${getTimestamp()}] [FALLBACK] RSSHub also failed for ${username}: ${fallbackError.message}${color.reset}`);
                    }
                }
            }

            return null;
        }
    }

    /**
     * Normalize post data from different sources to a standard format
     */
    normalizePostData(data, source) {
        if (source === 'puppeteer') {
            return {
                taken_at_timestamp: Math.floor(new Date(data.timestamp).getTime() / 1000) || Math.floor(Date.now() / 1000),
                caption: data.caption || 'No caption was provided',
                display_url: data.imageUrl,
                shortcode: data.postUrl ? data.postUrl.split('/p/')[1]?.split('/')[0] : null,
                source: 'puppeteer'
            };
        } else if (source === 'rsshub') {
            return {
                taken_at_timestamp: Math.floor(data.timestamp),
                caption: data.caption || 'No caption was provided',
                display_url: data.imageUrl,
                shortcode: data.postUrl ? data.postUrl.split('/p/')[1]?.split('/')[0] : null,
                source: 'rsshub'
            };
        }

        return data;
    }

    // ===== VALIDATION METHODS =====

    /**
     * Enhanced user validation with fallback
     */
    async validateUser(username) {
        const currentMode = this.getCurrentMode(username);
        
        try {
            if (currentMode === 'puppeteer') {
                const puppeteerResult = await this.validateUserViaPuppeteer(username);
                if (puppeteerResult) return true;
                
                // If Puppeteer fails, try other methods
                console.log(`${color.yellow}[${getTimestamp()}] [VALIDATION] Puppeteer validation failed, trying other methods${color.reset}`);
            }

            // Try original API methods
            for (let method of ['api', 'graphql', 'direct']) {
                let userData = null;
                
                switch (method) {
                    case 'api':
                        userData = await this.fetchUserViaApi(username);
                        break;
                    case 'graphql':
                        userData = await this.fetchUserViaGraphQL(username);
                        break;
                    case 'direct':
                        userData = await this.fetchUserDirectPage(username);
                        break;
                }
                
                if (userData) {
                    return true;
                }
                
                await this.delay(1000);
            }

            // Try RSSHub validation as last resort
            try {
                const rssResult = await this.fetchViaRSSHub(username);
                if (rssResult && rssResult.success) {
                    return true;
                }
            } catch (rssError) {
                console.log(`${color.yellow}[${getTimestamp()}] [VALIDATION] RSSHub validation also failed for ${username}${color.reset}`);
            }

            console.error(`${color.yellow}[${getTimestamp()}] [INSTA_API] User ${username} not found or private (tried all methods)${color.reset}`);
            return false;

        } catch (error) {
            console.error(`${color.red}[${getTimestamp()}] [VALIDATION] Error validating user ${username}: ${error.message}${color.reset}`);
            return false;
        }
    }

    /**
     * Validate user via Puppeteer
     */
    async validateUserViaPuppeteer(username) {
        try {
            if (!this.isPuppeteerInitialized) {
                const initialized = await this.initializePuppeteerCluster();
                if (!initialized) return false;
            }

            const result = await this.puppeteerCluster.execute({ username, isTest: true });
            return result && result.success;

        } catch (error) {
            return false;
        }
    }

    // ===== UTILITY METHODS =====

    /**
     * Get system health report
     */
    getSystemHealth() {
        const status = this.getFallbackStatus();
        const totalRequests = status.stats.puppeteer.success + status.stats.puppeteer.failures + 
                             status.stats.rsshub.success + status.stats.rsshub.failures;

        return {
            ...status,
            healthScore: totalRequests > 0 ? 
                Math.round(((status.stats.puppeteer.success + status.stats.rsshub.success) / totalRequests) * 100) : 0,
            avgResponseTime: {
                puppeteer: status.stats.puppeteer.success > 0 ? 
                    Math.round(status.stats.puppeteer.totalTime / status.stats.puppeteer.success) : 0,
                rsshub: status.stats.rsshub.success > 0 ? 
                    Math.round(status.stats.rsshub.totalTime / status.stats.rsshub.success) : 0
            },
            isPuppeteerActive: this.isPuppeteerInitialized,
            activeUsers: Array.from(this.fallbackSystem.userSpecificModes.keys())
        };
    }

    /**
     * Manually switch mode (for admin commands)
     */
    async switchMode(newMode, username = null) {
        const oldMode = username ? this.getCurrentMode(username) : this.fallbackSystem.mode;
        
        if (username) {
            this.fallbackSystem.userSpecificModes.set(username, newMode);
        } else {
            this.fallbackSystem.mode = newMode;
        }

        // If switching away from Puppeteer globally, close cluster to save resources
        if (oldMode === 'puppeteer' && newMode === 'rsshub' && !username) {
            await this.closePuppeteerCluster();
        }

        console.log(`${color.blue}[${getTimestamp()}] [MODE_SWITCH] Switched ${username || 'global'} mode: ${oldMode} → ${newMode}${color.reset}`);
        
        return {
            success: true,
            oldMode,
            newMode,
            target: username || 'global'
        };
    }

    /**
     * Reset fallback system (for admin recovery)
     */
    resetFallbackSystem() {
        this.fallbackSystem.failCount = 0;
        this.fallbackSystem.cooldownUntil = 0;
        this.fallbackSystem.mode = 'puppeteer';
        this.fallbackSystem.userSpecificModes.clear();
        
        console.log(`${color.green}[${getTimestamp()}] [RESET] Fallback system reset to default state${color.reset}`);
    }

    // ===== ORIGINAL METHODS (keeping existing functionality) =====

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    getRandomUserAgent() {
        return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
    }

    generateRealisticCookies(signature) {
        const now = Date.now();
        const futureDate = new Date(now + 90 * 24 * 60 * 60 * 1000).toUTCString();
        
        return [
            `ig_did=${signature.deviceId}; expires=${futureDate}; path=/; secure; HttpOnly`,
            `csrftoken=${signature.csrfToken}; expires=${futureDate}; path=/; secure`,
            `mid=${this.generateRandomString(26)}; expires=${futureDate}; path=/; secure; HttpOnly`,
            `ig_nrcb=1; expires=${futureDate}; path=/; secure`,
            `datr=${this.generateRandomString(24)}; expires=${futureDate}; path=/; secure; HttpOnly`,
        ].join('; ');
    }

    createInstagramHeaders(username, authLevel = 'standard') {
        const cookies = this.sessionManager.getCookies(username);
        const signature = this.sessionManager.activeSignatures[username];
        
        const baseHeaders = {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://www.instagram.com',
            'Referer': `https://www.instagram.com/${username}/`,
            'Connection': 'keep-alive',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Cookie': cookies
        };
        
        if (authLevel === 'guest' || authLevel === 'minimal') {
            return {
                ...baseHeaders,
                'X-IG-App-ID': signature.appId
            };
        } else {
            return {
                ...baseHeaders,
                'X-IG-App-ID': signature.appId,
                'X-ASBD-ID': signature.asbdId,
                'X-CSRFToken': signature.csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'X-Instagram-AJAX': '1',
                'DNT': '1'
            };
        }
    }

    async delay(ms, jitter = 0.3) {
        const jitterAmount = ms * jitter * (Math.random() * 2 - 1);
        const finalDelay = ms + jitterAmount;
        return new Promise(resolve => setTimeout(resolve, finalDelay));
    }

    async fetchWithRetry(url, options, maxRetries = 3) {
        let lastError;
        let username = 'unknown';
        
        const usernameMatch = url.match(/username=([^&]+)/) || url.match(/instagram\.com\/([^/?]+)/);
        if (usernameMatch) {
            username = decodeURIComponent(usernameMatch[1]);
        }
        
        let authStrategy = options.authStrategy || 'standard';
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    await this.delay(2000 * attempt);
                }
                
                if (attempt > 0) {
                    if (attempt === 1) {
                        authStrategy = 'minimal';
                    } else {
                        authStrategy = 'guest';
                    }
                    
                    options.headers = this.createInstagramHeaders(username, authStrategy);
                }
                
                const response = await fetch(url, options);
                
                if (response.status === 429) {
                    console.error(`${color.red}[${getTimestamp()}] [INSTA_API] Rate limited by Instagram, waiting longer...${color.reset}`);
                    await this.delay(5000 * (attempt + 1), 0.5);
                    continue;
                }
                
                if (response.status === 401 || response.status === 403) {
                    this.authStrategies.failures[authStrategy] = (this.authStrategies.failures[authStrategy] || 0) + 1;
                    
                    if (username !== 'unknown') {
                        this.sessionManager.refreshCookie(username);
                    }
                    
                    continue;
                }
                
                if (response.ok) {
                    this.authStrategies.success[authStrategy] = (this.authStrategies.success[authStrategy] || 0) + 1;
                }
                
                return response;
                
            } catch (error) {
                lastError = error;
            }
        }
        
        throw lastError || new Error('All fetch attempts failed');
    }

    async fetchUserViaApi(username) {
        const encodedUsername = encodeURIComponent(username);
        const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodedUsername}`;
        const headers = this.createInstagramHeaders(username, 'standard');
        
        try {
            const response = await this.fetchWithRetry(apiUrl, { 
                headers, 
                authStrategy: 'standard' 
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            return data?.data?.user || null;
        } catch (error) {
            return null;
        }
    }

    async fetchUserViaGraphQL(username) {
        const encodedUsername = encodeURIComponent(username);
        const graphqlUrl = `https://www.instagram.com/graphql/query/?query_hash=c9100bf9110dd6361671f113dd02e7d6&variables={"username":"${encodedUsername}","include_reel":false}`;
        const headers = this.createInstagramHeaders(username, 'minimal');
        
        try {
            const response = await this.fetchWithRetry(graphqlUrl, {
                headers,
                authStrategy: 'minimal'
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            return data?.data?.user || null;
        } catch (error) {
            return null;
        }
    }

    async fetchUserDirectPage(username) {
        const encodedUsername = encodeURIComponent(username);
        const userUrl = `https://www.instagram.com/${encodedUsername}/?__a=1&__d=dis`;
        const headers = this.createInstagramHeaders(username, 'guest');
        
        try {
            const response = await this.fetchWithRetry(userUrl, {
                headers,
                authStrategy: 'guest'
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            return data?.graphql?.user || data?.user || null;
        } catch (error) {
            return null;
        }
    }

    // ===== CLEANUP METHODS =====

    /**
     * Cleanup resources (call this when shutting down)
     */
    async cleanup() {
        console.log(`${color.yellow}[${getTimestamp()}] [CLEANUP] Starting Instagram API cleanup...${color.reset}`);
        
        if (this.puppeteerCluster && this.isPuppeteerInitialized) {
            try {
                await this.puppeteerCluster.close();
                console.log(`${color.green}[${getTimestamp()}] [CLEANUP] Puppeteer cluster closed${color.reset}`);
            } catch (error) {
                console.error(`${color.red}[${getTimestamp()}] [CLEANUP] Error closing Puppeteer cluster: ${error.message}${color.reset}`);
            }
        }

        // Log final statistics
        const health = this.getSystemHealth();
        console.log(`${color.cyan}[${getTimestamp()}] [STATISTICS] Final health score: ${health.healthScore}%${color.reset}`);
        console.log(`${color.cyan}[${getTimestamp()}] [STATISTICS] Total mode switches: ${health.totalSwitches}${color.reset}`);
    }
}

module.exports = new InstagramAPI();