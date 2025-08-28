const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { GroqChat } = require('../../utils/groqHelper'); 
const SetupChannel = require('../../schemas/aiChannelSystem');
const filter = require('../../jsons/filter.json');

module.exports = {
    underDevelopment: false,
    usableInDms: false,
    category: 'AI Commands',
    data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Generate AI chat response')
    .addSubcommand(command => command.setName('chat').setDescription('Generate AI chat response').addStringOption(option => option.setName('prompt').setDescription('Prompt for AI chat response').setRequired(true)))
    .addSubcommand(command => command.setName('setup-channel').setDescription('Setup AI channel for AI chat response').addChannelOption(option => option.setName('channel').setDescription('Channel to setup AI chat response').setRequired(true)).addStringOption(option => option.setName('ai-instructions').setDescription('Instructions for AI chat response').setRequired(false)))
    .addSubcommand(command => command.setName('disable-channel').setDescription('Disable AI chat response in a channel'))
    .addSubcommand(command => command.setName('update-ai-instructions').setDescription('Update AI instructions for AI chat response').addStringOption(option => option.setName('ai-instructions').setDescription('Instructions for AI chat response').setRequired(true))),
    async execute(interaction, client) {

        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();

        const filterMessage = "The prompt you have entered includes profanity which is **not** allowed. Please try again with a different prompt.";

        switch (sub) {
            case 'chat':
                await interaction.channel.sendTyping();

                const getChatPrompt = interaction.options.getString('prompt');

                if (filter.words.includes(getChatPrompt)) {
                    return await interaction.editReply({ content: `${filterMessage}`, flags: MessageFlags.Ephemeral });
                }

                const chatModel = `${client.config.aiChatModel}`;
                const chatPrompt = `${getChatPrompt}`;
                const chatOptions = {
                    userId: interaction.user.id,
                    memory: false,
                    limit: 100,
                    instruction: 'You are a friendly assistant.',
                };

                try {
                    const chatResponse = await GroqChat(chatModel, chatPrompt, chatOptions);

                    if (chatResponse.includes('@here') || chatResponse.includes('@everyone')) {
                        chatResponse = chatResponse.replace(/@here/g, '[here]').replace(/@everyone/g, '[everyone]');
                    }

                    let finalResponse = chatResponse;
                    if (chatResponse.length > 2000) {
                        finalResponse = chatResponse.substring(0, 1997) + '...';
                    }

                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `AI Chat Response ${client.config.devBy}`})
                    .setTitle(`${client.user.username} AI Chat Response ${client.config.arrowEmoji}`)
                    .setDescription(`**Prompt:** ${getChatPrompt}\n\n**Response:**\n${finalResponse}`)
                    .setColor(client.config.embedAi)
                    .setFooter({ text: `AI Chat Response`})
                    .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    console.log(error);
                    await interaction.editReply({ content: `An error occurred while generating AI chat response with the prompt: **${getChatPrompt}**. Please try again later.`, flags: MessageFlags.Ephemeral });
                    client.logs.error("[AI_CHAT_RESPONSE] Error occurred in AI Chat Response: ", error);
                }

            break;
            case 'setup-channel':

                const channel = interaction.options.getChannel('channel');
                const instruction = interaction.options.getString('ai-instructions') || 'You are a friendly assistant.';
                const channelID = channel.id;
                const serverID = interaction.guild.id;

                if (filter.words.includes(instruction)) {
                    return await interaction.editReply({ content: `${filterMessage}`, flags: MessageFlags.Ephemeral });
                }

                const setupChannel = new SetupChannel({ 
                    serverID, 
                    channelID, 
                    instruction 
                });

                await setupChannel.save();

                try {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `AI Channel Setup ${client.config.devBy}`})
                    .setTitle(`${client.user.username} AI Channel Setup ${client.config.arrowEmoji}`)
                    .setDescription(`AI chat response has been setup in this channel!`)
                    .addFields({ name: `Channel`, value: `<#${channelID}>`})
                    .addFields({ name: `AI Instructions`, value: `${instruction}`})
                    .setColor(client.config.embedAi)
                    .setFooter({ text: `AI Chat Response Setup`})
                    .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    console.log(error);
                    await interaction.editReply({ content: `An error occurred while setting up AI chat response in this channel. Please try again later.`, flags: MessageFlags.Ephemeral });
                    client.logs.error("[AI_CHANNEL_SETUP] Error occurred in AI Channel Setup: ", error);
                }

            break;
            case 'disable-channel':

                const disableChannel = await SetupChannel.findOneAndDelete({ serverID: interaction.guild.id });

                if (!disableChannel) return await interaction.editReply({ content: `AI chat response has **not** yet been setup in this server!`, flags: MessageFlags.Ephemeral });

                try {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `AI Channel Disable ${client.config.devBy}`})
                    .setTitle(`${client.user.username} AI Channel Disable ${client.config.arrowEmoji}`)
                    .setDescription(`AI chat response has been disabled in this server!`)
                    .setColor(client.config.embedAi)
                    .setFooter({ text: `AI Chat Response Disable`})
                    .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    console.log(error);
                    await interaction.editReply({ content: `An error occurred while disabling AI chat response in this channel. Please try again later.`, flags: MessageFlags.Ephemeral });
                    client.logs.error("[AI_CHANNEL_DISABLE] Error occurred in AI Channel Disable: ", error);
                }

            break;
            case 'update-ai-instructions':

                const getInstructions = interaction.options.getString('ai-instructions');

                if (filter.words.includes(getInstructions)) {
                    return await interaction.editReply({ content: `${filterMessage}`, flags: MessageFlags.Ephemeral });
                }

                const updateInstructions = await SetupChannel.findOneAndUpdate({ serverID: interaction.guild.id }, { instruction: getInstructions });

                if (!updateInstructions) return await interaction.editReply({ content: `AI chat response has **not** yet been setup in this server!`, flags: MessageFlags.Ephemeral });

                try {
                    const embed = new EmbedBuilder()
                    .setAuthor({ name: `AI Channel Update ${client.config.devBy}`})
                    .setTitle(`${client.user.username} AI Channel Update ${client.config.arrowEmoji}`)
                    .setDescription(`AI chat response instructions have been updated in this server!`)
                    .addFields({ name: `AI Instructions`, value: `${getInstructions}`})
                    .setColor(client.config.embedAi)
                    .setFooter({ text: `AI Chat Response Update`})
                    .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    console.log(error);
                    await interaction.editReply({ content: `An error occurred while updating AI chat response instructions in this channel. Please try again later.`, flags: MessageFlags.Ephemeral });
                    client.logs.error("[AI_CHANNEL_UPDATE] Error occurred in AI Channel Update: ", error);
                }
                
            break;
        }
    }
};
