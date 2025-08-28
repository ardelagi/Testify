// src/commands/AiCommands/motionlifeAi.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { GroqChat } = require('../../utils/groqHelper');
const motionlifeKnowledge = require('../../jsons/motionlife-knowledge.json');
const filter = require('../../jsons/filter.json');

module.exports = {
    underDevelopment: false,
    usableInDms: false,
    category: 'AI Commands',
    data: new SlashCommandBuilder()
        .setName('motionlife-ai')
        .setDescription('AI Helper for Motionlife Roleplay')
        .addStringOption(option => 
            option.setName('prompt')
                .setDescription('Ask anything about Motionlife Roleplay')
                .setRequired(true)
        ),
    
    async execute(interaction, client) {
        // Role yang diizinkan menggunakan command
        const allowedRoles = [
            '1383040700400013410', // Admin Role ID
            '1383040700400013411', // Moderator Role ID  
            '1403615161230819469', // Helper Role ID
            '1398006975475744939', // Staff Role ID
            // Tambahkan role ID lain yang diizinkan
        ];

        // Check apakah user memiliki role yang diizinkan
        const hasPermission = interaction.member.roles.cache.some(role => 
            allowedRoles.includes(role.id)
        );

        if (!hasPermission) {
            const noPermEmbed = new EmbedBuilder()
                .setAuthor({ name: `Access Denied ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} Motionlife AI Helper`)
                .setDescription(`You don't have permission to use this command!\n\nOnly **Staff Members** can access Motionlife AI Helper.`)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Access Control' })
                .setTimestamp();

            return await interaction.reply({ 
                embeds: [noPermEmbed], 
                ephemeral: true 
            });
        }

        await interaction.deferReply();

        const userPrompt = interaction.options.getString('prompt');

        // Filter profanity
        if (filter.words.some(word => userPrompt.toLowerCase().includes(word.toLowerCase()))) {
            const filterEmbed = new EmbedBuilder()
                .setAuthor({ name: `Content Filter ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} Message Filtered`)
                .setDescription(`Your message contains inappropriate content. Please rephrase your question.`)
                .setColor('#FF4500')
                .setFooter({ text: 'Motionlife Roleplay • Content Filter' })
                .setTimestamp();

            return await interaction.editReply({ 
                embeds: [filterEmbed], 
                flags: MessageFlags.Ephemeral 
            });
        }

        try {
            await interaction.followUp({ content: '🤖 *Sedang memproses pertanyaan Anda...*' });

            // Build knowledge base dari JSON
            const knowledgeBase = buildKnowledgeContext(motionlifeKnowledge);
            
            const systemInstruction = `
You are an AI helper for Motionlife Roleplay, a FiveM roleplay server. Your role is to help staff and players with questions about the server.

IMPORTANT GUIDELINES:
1. ONLY answer questions related to Motionlife Roleplay, FiveM roleplay, or general roleplay concepts
2. Use the provided knowledge base as your primary source of information
3. If you don't have specific information, say "I don't have that specific information in my knowledge base"
4. Be friendly, helpful, and professional
5. Use Indonesian language primarily, but English is okay if the user asks in English
6. Format your responses clearly and concisely
7. If asked about rules, be precise and refer to official server rules

KNOWLEDGE BASE:
${knowledgeBase}

Remember: You represent Motionlife Roleplay server, so maintain a professional and helpful tone.
            `;

            const chatOptions = {
                userId: interaction.user.id,
                memory: false,
                limit: 200,
                instruction: systemInstruction
            };

            const aiResponse = await GroqChat('llama-3.3-70b-versatile', userPrompt, chatOptions);

            // Format response dengan embed
            const responseEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Motionlife AI Helper ${client.config.devBy}`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTitle(`🤖 AI Response`)
                .setDescription(`**❓ Pertanyaan:**\n${userPrompt}\n\n**💡 Jawaban:**\n${aiResponse}`)
                .setColor('#00FF88') // Warna hijau untuk Motionlife
                .addFields(
                    { 
                        name: '📋 Info', 
                        value: 'AI ini menggunakan knowledge base Motionlife Roleplay yang terupdate.', 
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: `Motionlife Roleplay • Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // Hapus pesan loading
            await interaction.deleteReply();
            
            // Send response embed
            await interaction.followUp({ embeds: [responseEmbed] });

            // Log usage (optional)
            console.log(`[MOTIONLIFE_AI] ${interaction.user.tag} asked: ${userPrompt}`);

        } catch (error) {
            console.error('[MOTIONLIFE_AI] Error:', error);

            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: `Error ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} AI Error`)
                .setDescription(`Maaf, terjadi kesalahan saat memproses pertanyaan Anda.\n\nSilakan coba lagi dalam beberapa saat.`)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Error Handler' })
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [errorEmbed], 
                flags: MessageFlags.Ephemeral 
            });

            client.logs.error("[MOTIONLIFE_AI] Error occurred:", error);
        }
    }
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
        context += `IP: ${knowledge.serverInfo.ip}\n`;
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
        });
        context += '\n';
    }

    // Locations
    if (knowledge.locations && knowledge.locations.length > 0) {
        context += `IMPORTANT LOCATIONS:\n`;
        knowledge.locations.forEach(location => {
            context += `- ${location.name}: ${location.description}\n`;
            if (location.coordinates) context += `  Location: ${location.coordinates}\n`;
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

    return context;
}