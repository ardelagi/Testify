// src/commands/AiCommands/setupMotionlifeAi.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const MotionlifeAiChannel = require('../../schemas/motionlifeAiChannel');

module.exports = {
    underDevelopment: false,
    usableInDms: false,
    category: 'AI Commands',
    data: new SlashCommandBuilder()
        .setName('setup-motionlife-ai')
        .setDescription('Setup AI channel khusus untuk Motionlife Roleplay FiveM')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel untuk AI Helper Motionlife')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('allowed-role')
                .setDescription('Role yang bisa menggunakan AI (opsional, default: Staff roles)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        // Hanya admin atau owner yang bisa setup
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const noPermEmbed = new EmbedBuilder()
                .setAuthor({ name: `Access Denied ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} Setup Failed`)
                .setDescription(`You need **Administrator** permission to setup Motionlife AI channel.`)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Setup Control' })
                .setTimestamp();

            return await interaction.reply({ 
                embeds: [noPermEmbed], 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const allowedRole = interaction.options.getRole('allowed-role');
        
        try {
            // Check if channel already setup
            const existingSetup = await MotionlifeAiChannel.findOne({ 
                guildId: interaction.guild.id,
                channelId: channel.id 
            });

            if (existingSetup) {
                const existsEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Setup Warning ${client.config.devBy}` })
                    .setTitle(`⚠️ Channel Already Setup`)
                    .setDescription(`Channel ${channel} is already configured as Motionlife AI Helper.\n\nUse \`/remove-motionlife-ai\` to remove it first.`)
                    .setColor('#FF8C00')
                    .setFooter({ text: 'Motionlife Roleplay • Setup Manager' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [existsEmbed] });
            }

            // Create new setup
            const newSetup = new MotionlifeAiChannel({
                guildId: interaction.guild.id,
                channelId: channel.id,
                allowedRoleId: allowedRole ? allowedRole.id : null,
                setupBy: interaction.user.id,
                setupAt: new Date()
            });

            await newSetup.save();

            // Success embed
            const successEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Motionlife AI Setup ${client.config.devBy}`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTitle(`${client.config.countSuccessEmoji} AI Channel Setup Complete`)
                .setDescription(`Motionlife AI Helper has been successfully configured!`)
                .addFields(
                    { 
                        name: '📍 Channel', 
                        value: `${channel}`, 
                        inline: true 
                    },
                    { 
                        name: '👥 Allowed Role', 
                        value: allowedRole ? `${allowedRole}` : 'Default Staff Roles', 
                        inline: true 
                    },
                    { 
                        name: '🎮 Focus', 
                        value: 'Motionlife Roleplay FiveM', 
                        inline: true 
                    },
                    {
                        name: '🤖 How to Use',
                        value: `Users with proper roles can:\n• Mention the bot with questions\n• Reply to bot messages\n• Ask about server rules, jobs, locations\n• Get help with roleplay scenarios`,
                        inline: false
                    }
                )
                .setColor('#00FF88')
                .setFooter({ 
                    text: `Setup by ${interaction.user.tag} • Motionlife Roleplay`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Send welcome message to the channel
            const welcomeEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Motionlife AI Helper Activated`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTitle(`🤖 Welcome to Motionlife AI Helper!`)
                .setDescription(`I'm here to help with questions about **Motionlife Roleplay FiveM**!`)
                .addFields(
                    {
                        name: '💡 What I can help with:',
                        value: `• Server rules and regulations\n• Job information and requirements\n• Location guides and services\n• Commands and how to use them\n• Roleplay scenarios and tips\n• FAQ and common questions`,
                        inline: false
                    },
                    {
                        name: '🎯 How to use:',
                        value: `• **Mention me** with your question\n• **Reply** to my messages for follow-up\n• Ask in **Indonesian** or **English**`,
                        inline: false
                    },
                    {
                        name: '⚡ Example questions:',
                        value: `"Bagaimana cara join LSPD?"\n"Apa itu RDM dan VDM?"\n"Dimana lokasi mechanic shop?"\n"Rules tentang gang activity?"`,
                        inline: false
                    }
                )
                .setColor('#00FF88')
                .setFooter({ text: 'Motionlife Roleplay • AI Helper System' })
                .setTimestamp();

            await channel.send({ embeds: [welcomeEmbed] });

            console.log(`[MOTIONLIFE_AI_SETUP] Channel ${channel.name} setup by ${interaction.user.tag}`);

        } catch (error) {
            console.error('[MOTIONLIFE_AI_SETUP] Error:', error);

            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: `Setup Error ${client.config.devBy}` })
                .setTitle(`${client.config.errorEmoji} Setup Failed`)
                .setDescription(`Failed to setup Motionlife AI Helper.\n\nError: \`${error.message}\``)
                .setColor('#FF0000')
                .setFooter({ text: 'Motionlife Roleplay • Error Handler' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            client.logs.error("[MOTIONLIFE_AI_SETUP] Error occurred:", error);
        }
    }
};
