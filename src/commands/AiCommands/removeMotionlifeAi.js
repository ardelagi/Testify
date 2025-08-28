// src/commands/AiCommands/removeMotionlifeAi.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const MotionlifeAiChannel = require('../../schemas/motionlifeAiChannel');

module.exports = {
    underDevelopment: false,
    usableInDms: false,
    category: 'AI Commands',
    data: new SlashCommandBuilder()
        .setName('remove-motionlife-ai')
        .setDescription('Remove AI channel setup untuk Motionlife Roleplay')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel yang akan di-remove dari AI system')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        // Check admin permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const noPermEmbed = new EmbedBuilder()
                .setAuthor({ name: `Access Denied ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} Remove Failed`)
                .setDescription(`You need **Administrator** permission to remove Motionlife AI channel.`)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Remove Control' })
                .setTimestamp();

            return await interaction.reply({ 
                embeds: [noPermEmbed], 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetChannel = interaction.options.getChannel('channel');
        
        try {
            let query = { guildId: interaction.guild.id };
            
            // If specific channel is provided, target only that channel
            if (targetChannel) {
                query.channelId = targetChannel.id;
            }

            // Find existing setups
            const existingSetups = await MotionlifeAiChannel.find(query);

            if (existingSetups.length === 0) {
                const notFoundEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Remove Status ${client.config.devBy}` })
                    .setTitle(`⚠️ No Setup Found`)
                    .setDescription(
                        targetChannel 
                            ? `Channel ${targetChannel} is not configured as Motionlife AI Helper.`
                            : `No Motionlife AI channels are configured in this server.`
                    )
                    .setColor('#FF8C00')
                    .setFooter({ text: 'Motionlife Roleplay • Remove Manager' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [notFoundEmbed] });
            }

            // Remove the setups
            const deleteResult = await MotionlifeAiChannel.deleteMany(query);

            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Motionlife AI Remove ${client.config.devBy}`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTitle(`${client.config.countSuccessEmoji} AI Channel Removed`)
                .setDescription(`Motionlife AI Helper has been successfully removed!`)
                .addFields(
                    { 
                        name: '📊 Removed', 
                        value: `${deleteResult.deletedCount} channel(s)`, 
                        inline: true 
                    },
                    { 
                        name: '🎯 Target', 
                        value: targetChannel ? `${targetChannel}` : 'All AI channels in server', 
                        inline: true 
                    },
                    { 
                        name: '⏰ Action', 
                        value: 'AI responses disabled', 
                        inline: true 
                    }
                )
                .setColor('#FF4444')
                .setFooter({ 
                    text: `Removed by ${interaction.user.tag} • Motionlife Roleplay`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Send goodbye message to the removed channels if specific channel
            if (targetChannel && existingSetups.length === 1) {
                try {
                    const goodbyeEmbed = new EmbedBuilder()
                        .setAuthor({ 
                            name: `Motionlife AI Helper Deactivated`,
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setTitle(`👋 AI Helper Removed`)
                        .setDescription(`Motionlife AI Helper has been removed from this channel.\n\nTo reactivate, use \`/setup-motionlife-ai\` command.`)
                        .setColor('#FF4444')
                        .setFooter({ text: 'Motionlife Roleplay • AI System' })
                        .setTimestamp();

                    await targetChannel.send({ embeds: [goodbyeEmbed] });
                } catch (error) {
                    console.log('[MOTIONLIFE_AI_REMOVE] Could not send goodbye message:', error.message);
                }
            }

            console.log(`[MOTIONLIFE_AI_REMOVE] ${deleteResult.deletedCount} channel(s) removed by ${interaction.user.tag}`);

        } catch (error) {
            console.error('[MOTIONLIFE_AI_REMOVE] Error:', error);

            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: `Remove Error ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} Remove Failed`)
                .setDescription(`Failed to remove Motionlife AI Helper.\n\nError: \`${error.message}\``)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Error Handler' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            client.logs.error("[MOTIONLIFE_AI_REMOVE] Error occurred:", error);
        }
    }
};