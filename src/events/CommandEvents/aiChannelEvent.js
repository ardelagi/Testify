const { Events } = require('discord.js');
const SetupChannel = require('../../schemas/aiChannelSystem');
const { ApexChat } = require('apexify.js');
const filter = require('../../jsons/filter.json');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (!message.guild || message.author.bot) return;

        const botMentioned = message.content.includes(`<@${client.user.id}>`);

        // Aman fetch reference
        let isReplyToBot = false;
        if (message.reference) {
            try {
                const refMessage = await message.fetchReference();
                if (refMessage && refMessage.author.id === client.user.id) {
                    isReplyToBot = true;
                }
            } catch (err) {
                console.warn(`[AI_CHANNEL_EVENT] Failed to fetch reference message: ${err.message}`);
            }
        }

        if (!botMentioned && !isReplyToBot) return;

        // Filter kata kasar
        if (filter.words.some(word => message.content.includes(word))) {
            return message.reply({
                content: `Woah! Your message includes profanity which is **not** allowed! Try sending your message again without using that language.`
            });
        }

        const setupChannel = await SetupChannel.findOne({ channelID: message.channel.id });
        if (!setupChannel) return;

        const { instruction } = setupChannel;

        const chatModel = `${client.config.aiChatChannelModel}`;
        const chatPrompt = `${message.content}`;
        const chatOptions = {
            userId: `${message.author.id}-${message.guild.id}`,
            memory: true,
            limit: 12,
            instruction: `${instruction}`,
        };

        try {
            await message.channel.sendTyping();

            let chatResponse = await ApexChat(chatModel, chatPrompt, chatOptions);

            if (!chatResponse || chatResponse.trim().length === 0) {
                client.logs.error(`[AI_CHANNEL_EVENT] Received an empty response from the AI for prompt: ${chatPrompt}`);
                return message.reply('The AI **did not** return a response. Please try again with a different prompt.');
            }

            // Aman replace @here dan @everyone
            chatResponse = chatResponse.replace(/@here/g, '[here]').replace(/@everyone/g, '[everyone]');

            // Truncate jika lebih dari 2000 karakter
            if (chatResponse.length > 1995) {
                const truncatedResponse = chatResponse.substring(0, 1995) + '...';
                await message.reply(truncatedResponse);
            } else {
                await message.reply(chatResponse);
            }

        } catch (error) {
            console.error(`[AI_CHANNEL_EVENT] Error: ${error.message}`);
            await message.reply('An error occurred while generating the AI response. Please try again later.');
            client.logs.error(`[AI_CHANNEL_EVENT] Error occurred with prompt: ${chatPrompt}`);
        }
    },
};