// src/events/CommandEvents/motionlifeAiEvent.js
const { Events, EmbedBuilder } = require('discord.js');
const MotionlifeAiChannel = require('../../schemas/motionlifeAiChannel');
const { GroqChat } = require('../../utils/groqHelper');
const motionlifeKnowledge = require('../../jsons/motionlife-knowledge.json');
const filter = require('../../jsons/filter.json');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (!message.guild || message.author.bot) return;

        // Check if bot is mentioned or message is reply to bot
        const botMentioned = message.content.includes(`<@${client.user.id}>`);
        let isReplyToBot = false;

        if (message.reference) {
            try {
                const refMessage = await message.fetchReference();
                if (refMessage && refMessage.author.id === client.user.id) {
                    isReplyToBot = true;
                }
            } catch (err) {
                console.warn(`[MOTIONLIFE_AI_EVENT] Failed to fetch reference message: ${err.message}`);
            }
        }

        if (!botMentioned && !isReplyToBot) return;

        // Check if channel is setup for Motionlife AI
        const aiChannelSetup = await MotionlifeAiChannel.findOne({ 
            guildId: message.guild.id,
            channelId: message.channel.id,
            isActive: true
        });

        if (!aiChannelSetup) return;

        // Check user permissions
        const defaultAllowedRoles = [
            '1383040700400013410', // Admin Role ID - GANTI DENGAN ROLE ID YANG SEBENARNYA
            '1383040700400013411', // Moderator Role ID
            '1403615161230819469', // Helper Role ID
            '1398006975475744939', // Staff Role ID
            // Tambahkan role ID lain sesuai kebutuhan server Anda
        ];

        const allowedRoles = aiChannelSetup.allowedRoleId 
            ? [aiChannelSetup.allowedRoleId, ...defaultAllowedRoles]
            : defaultAllowedRoles;

        const hasPermission = message.member.roles.cache.some(role => 
            allowedRoles.includes(role.id)
        );

        if (!hasPermission) {
            const noPermEmbed = new EmbedBuilder()
                .setAuthor({ name: `Access Denied` })
                .setTitle(`🚫 Permission Required`)
                .setDescription(`Only **Staff Members** can use Motionlife AI Helper.\n\nContact administrators if you believe this is an error.`)
                .setColor('#FF4500')
                .setFooter({ text: 'Motionlife Roleplay • Access Control' })
                .setTimestamp();

            const reply = await message.reply({ embeds: [noPermEmbed] });
            
            // Auto delete after 10 seconds
            setTimeout(async () => {
                try {
                    await reply.delete();
                } catch (error) {
                    console.log('[MOTIONLIFE_AI_EVENT] Could not delete permission error message');
                }
            }, 10000);
            
            return;
        }

        // Filter profanity
        if (filter.words.some(word => message.content.toLowerCase().includes(word.toLowerCase()))) {
            const filterEmbed = new EmbedBuilder()
                .setAuthor({ name: `Content Filter` })
                .setTitle(`🚫 Message Filtered`)
                .setDescription(`Your message contains inappropriate content.\n\nPlease rephrase your question appropriately.`)
                .setColor('#FF4500')
                .setFooter({ text: 'Motionlife Roleplay • Content Filter' })
                .setTimestamp();

            return message.reply({ embeds: [filterEmbed] });
        }

        try {
            // Show typing indicator
            await message.channel.sendTyping();

            // Clean the message content (remove mentions)
            let cleanPrompt = message.content
                .replace(`<@${client.user.id}>`, '')
                .replace(`<@!${client.user.id}>`, '')
                .trim();

            if (!cleanPrompt) {
                const helpEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: `Motionlife AI Helper`,
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTitle(`🤖 How can I help you?`)
                    .setDescription(`Ask me anything about **Motionlife Roleplay FiveM**!`)
                    .addFields(
                        {
                            name: '💡 Example questions:',
                            value: `• "Bagaimana cara join LSPD?"\n• "Apa rules tentang RDM?"\n• "Dimana lokasi hospital?"\n• "Command apa saja yang tersedia?"`,
                            inline: false
                        }
                    )
                    .setColor('#00FF88')
                    .setFooter({ text: 'Motionlife Roleplay • AI Helper' })
                    .setTimestamp();

                return message.reply({ embeds: [helpEmbed] });
            }

            // Build knowledge context
            const knowledgeBase = buildKnowledgeContext(motionlifeKnowledge);
            
            const systemInstruction = `
You are an AI helper for Motionlife Roleplay, a FiveM roleplay server in Indonesia. Your role is to help staff and players with questions about the server.

IMPORTANT GUIDELINES:
1. ONLY answer questions related to Motionlife Roleplay, FiveM roleplay, or general roleplay concepts
2. Use the provided knowledge base as your primary source of information
3. If you don't have specific information, say "Saya tidak memiliki informasi spesifik tentang itu dalam knowledge base saya"
4. Be friendly, helpful, and professional - you represent the server
5. Use Indonesian language primarily, but English is okay if the user asks in English
6. Format your responses clearly and be concise (max 300 words)
7. If asked about rules, be precise and refer to official server rules
8. For complex questions, suggest contacting admin via ticket
9. Always maintain roleplay context and realism

KNOWLEDGE BASE:
${knowledgeBase}

Current user: ${message.author.tag} (Staff Member)
Server: ${message.guild.name}
Channel: #${message.channel.name}

Remember: You represent Motionlife Roleplay server, so maintain a professional and helpful tone while being approachable.
            `;

            const chatOptions = {
                userId: `${message.author.id}-motionlife`,
                memory: true,
                limit: 300, // word limit
                instruction: systemInstruction
            };

            // Get AI response
            const aiResponse = await GroqChat('llama-3.3-70b-versatile', cleanPrompt, chatOptions);

            // Check if response is empty
            if (!aiResponse || aiResponse.trim().length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setAuthor({ name: `AI Error` })
                    .setTitle(`❌ No Response`)
                    .setDescription(`Maaf, AI tidak dapat memberikan response untuk pertanyaan Anda.\n\nSilakan coba pertanyaan yang lebih spesifik.`)
                    .setColor('#FF0000')
                    .setFooter({ text: 'Motionlife Roleplay • AI Helper' })
                    .setTimestamp();

                return message.reply({ embeds: [errorEmbed] });
            }

            // Remove potential mentions from AI response
            let cleanResponse = aiResponse
                .replace(/@here/g, '[here]')
                .replace(/@everyone/g, '[everyone]')
                .replace(/<@&\d+>/g, '[role]')
                .replace(/<@!?\d+>/g, '[user]');

            // Truncate if too long for embed
            if (cleanResponse.length > 4000) {
                cleanResponse = cleanResponse.substring(0, 3997) + '...';
            }

            // Create response embed
            const responseEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Motionlife AI Helper`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTitle(`🤖 AI Response`)
                .setDescription(`**❓ Pertanyaan:**\n> ${cleanPrompt.length > 100 ? cleanPrompt.substring(0, 100) + '...' : cleanPrompt}\n\n**💡 Jawaban:**\n${cleanResponse}`)
                .setColor('#00FF88')
                .addFields(
                    {
                        name: '📋 Catatan',
                        value: 'Informasi berdasarkan knowledge base Motionlife RP yang terupdate.\nUntuk pertanyaan kompleks, silakan buat ticket di Discord.',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Motionlife Roleplay • Requested by ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            // Send response
            await message.reply({ embeds: [responseEmbed] });

            // Update last used timestamp
            await MotionlifeAiChannel.updateOne(
                { guildId: message.guild.id, channelId: message.channel.id },
                { lastUsed: new Date() }
            );

            // Log usage
            console.log(`[MOTIONLIFE_AI] ${message.author.tag} in #${message.channel.name}: ${cleanPrompt.substring(0, 50)}...`);

        } catch (error) {
            console.error(`[MOTIONLIFE_AI_EVENT] Error: ${error.message}`);

            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: `AI System Error` })
                .setTitle(`❌ Error Occurred`)
                .setDescription(`Maaf, terjadi kesalahan sistem saat memproses pertanyaan Anda.\n\n**Error:** \`${error.message.substring(0, 100)}\`\n\nSilakan coba lagi dalam beberapa saat atau hubungi admin.`)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Error Handler' })
                .setTimestamp();

            try {
                await message.reply({ embeds: [errorEmbed] });
            } catch (replyError) {
                console.error(`[MOTIONLIFE_AI_EVENT] Could not send error message: ${replyError.message}`);
            }

            client.logs.error(`[MOTIONLIFE_AI_EVENT] Error occurred with prompt: ${cleanPrompt}`, error);
        }
    },
};

/**
 * Build knowledge context from JSON data
 * @param {Object} knowledge - Knowledge base object
 * @returns {string} - Formatted knowledge string
 */
function buildKnowledgeContext(knowledge) {
    let context = '';
    
    // Server Info
    if (knowledge.serverInfo) {
        context += `SERVER INFORMATION:\n`;
        context += `Name: ${knowledge.serverInfo.name}\n`;
        context += `Type: ${knowledge.serverInfo.type}\n`;
        context += `Description: ${knowledge.serverInfo.description}\n`;
        context += `Max Players: ${knowledge.serverInfo.maxPlayers}\n`;
        context += `Language: ${knowledge.serverInfo.language}\n`;
        context += `Timezone: ${knowledge.serverInfo.timezone}\n`;
        context += `Discord: ${knowledge.serverInfo.discord}\n\n`;
    }

    // Rules
    if (knowledge.rules && knowledge.rules.length > 0) {
        context += `SERVER RULES:\n`;
        knowledge.rules.forEach((rule, index) => {
            context += `${index + 1}. ${rule}\n`;
        });
        context += '\n';
    }

    // Jobs
    if (knowledge.jobs && knowledge.jobs.length > 0) {
        context += `AVAILABLE JOBS:\n`;
        knowledge.jobs.forEach(job => {
            context += `- ${job.name}: ${job.description}\n`;
            if (job.requirements) context += `  Requirements: ${job.requirements}\n`;
            if (job.salary) context += `  Salary: ${job.salary}\n`;
            if (job.ranks) context += `  Ranks: ${job.ranks.join(', ')}\n`;
        });
        context += '\n';
    }

    // Locations
    if (knowledge.locations && knowledge.locations.length > 0) {
        context += `IMPORTANT LOCATIONS:\n`;
        knowledge.locations.forEach(location => {
            context += `- ${location.name}: ${location.description}\n`;
            if (location.coordinates) context += `  Location: ${location.coordinates}\n`;
            if (location.services) context += `  Services: ${location.services.join(', ')}\n`;
        });
        context += '\n';
    }

    // Commands
    if (knowledge.commands && knowledge.commands.length > 0) {
        context += `SERVER COMMANDS:\n`;
        knowledge.commands.forEach(cmd => {
            context += `- ${cmd.command}: ${cmd.description}\n`;
            if (cmd.usage) context += `  Usage: ${cmd.usage}\n`;
        });
        context += '\n';
    }

    // FAQ
    if (knowledge.faq && knowledge.faq.length > 0) {
        context += `FREQUENTLY ASKED QUESTIONS:\n`;
        knowledge.faq.forEach((faq, index) => {
            context += `Q${index + 1}: ${faq.question}\n`;
            context += `A${index + 1}: ${faq.answer}\n\n`;
        });
    }

    // Businesses
    if (knowledge.businesses && knowledge.businesses.length > 0) {
        context += `BUSINESSES:\n`;
        knowledge.businesses.forEach(business => {
            context += `- ${business.name} (${business.type}): ${business.description}\n`;
            if (business.location) context += `  Location: ${business.location}\n`;
        });
        context += '\n';
    }

    return context;
}