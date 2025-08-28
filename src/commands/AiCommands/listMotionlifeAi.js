// src/commands/AiCommands/listMotionlifeAi.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const MotionlifeAiChannel = require('../../schemas/motionlifeAiChannel');

module.exports = {
    underDevelopment: false,
    usableInDms: false,
    category: 'AI Commands',
    data: new SlashCommandBuilder()
        .setName('list-motionlife-ai')
        .setDescription('List semua AI channels untuk Motionlife Roleplay')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, client) {
        // Check manage channels permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            const noPermEmbed = new EmbedBuilder()
                .setAuthor({ name: `Access Denied ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} List Failed`)
                .setDescription(`You need **Manage Channels** permission to view AI channel list.`)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • List Control' })
                .setTimestamp();

            return await interaction.reply({ 
                embeds: [noPermEmbed], 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Find all AI channels in this guild
            const aiChannels = await MotionlifeAiChannel.find({ 
                guildId: interaction.guild.id,
                isActive: true 
            }).sort({ setupAt: -1 });

            if (aiChannels.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: `Motionlife AI Channels ${client.config.devBy}`,
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTitle(`📋 AI Channel List`)
                    .setDescription(`No Motionlife AI channels are configured in this server.\n\nUse \`/setup-motionlife-ai\` to setup one.`)
                    .setColor('#FF8C00')
                    .setFooter({ text: 'Motionlife Roleplay • Channel Manager' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [emptyEmbed] });
            }

            // Build channel list
            let channelList = '';
            let totalUsage = 0;

            for (let i = 0; i < aiChannels.length && i < 10; i++) { // Limit to 10 channels
                const setup = aiChannels[i];
                const channel = interaction.guild.channels.cache.get(setup.channelId);
                const setupUser = await client.users.fetch(setup.setupBy).catch(() => null);
                const allowedRole = setup.allowedRoleId ? interaction.guild.roles.cache.get(setup.allowedRoleId) : null;

                if (channel) {
                    const timeSinceSetup = Math.floor((Date.now() - setup.setupAt.getTime()) / (1000 * 60 * 60 * 24));
                    const timeSinceUsed = Math.floor((Date.now() - setup.lastUsed.getTime()) / (1000 * 60 * 60));

                    channelList += `**${i + 1}.** ${channel}\n`;
                    channelList += `   👤 Setup by: ${setupUser ? setupUser.tag : 'Unknown'}\n`;
                    channelList += `   📅 Setup: ${timeSinceSetup} days ago\n`;
                    channelList += `   ⏰ Last used: ${timeSinceUsed}h ago\n`;
                    channelList += `   👥 Role: ${allowedRole ? allowedRole.name : 'Default Staff'}\n\n`;
                }
                totalUsage++;
            }

            // Create list embed
            const listEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Motionlife AI Channels ${client.config.devBy}`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTitle(`📋 AI Channel List`)
                .setDescription(`Active Motionlife AI Helper channels in **${interaction.guild.name}**:\n\n${channelList}`)
                .addFields(
                    { 
                        name: '📊 Statistics', 
                        value: `Total Active: **${aiChannels.length}**\nShowing: **${Math.min(aiChannels.length, 10)}**`, 
                        inline: true 
                    },
                    { 
                        name: '🎮 Focus', 
                        value: 'Motionlife Roleplay FiveM', 
                        inline: true 
                    },
                    { 
                        name: '🤖 Model', 
                        value: 'Llama 3.3 70B', 
                        inline: true 
                    }
                )
                .setColor('#00FF88')
                .setFooter({ 
                    text: `Requested by ${interaction.user.tag} • Motionlife Roleplay`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [listEmbed] });

            console.log(`[MOTIONLIFE_AI_LIST] ${interaction.user.tag} viewed AI channel list (${aiChannels.length} channels)`);

        } catch (error) {
            console.error('[MOTIONLIFE_AI_LIST] Error:', error);

            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: `List Error ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} List Failed`)
                .setDescription(`Failed to retrieve Motionlife AI channel list.\n\nError: \`${error.message}\``)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Error Handler' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            client.logs.error("[MOTIONLIFE_AI_LIST] Error occurred:", error);
        }
    }
};