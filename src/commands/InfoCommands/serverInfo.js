const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    GuildVerificationLevel,
    GuildExplicitContentFilter,
    GuildNSFWLevel
} = require("discord.js");

const FiveMAPI = require("../../api/fivemApi");
const SERVER_ID = "5j433z"; // bisa dipindah ke config

module.exports = {
    usableInDms: false,
    category: "Info",
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Show server information (Discord or FiveM).")
        .addSubcommand(sub =>
            sub.setName("discord").setDescription("Displays information about this Discord server.")
        )
        .addSubcommand(sub =>
            sub.setName("fivem").setDescription("Displays information about the FiveM server.")
        ),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        // === DISCORD SERVER INFO ===
        if (sub === "discord") {
            const { guild } = interaction;
            const { members, channels, emojis, roles, stickers } = guild;

            const sortedRoles = roles.cache.map(r => r).slice(1).sort((a, b) => b.position - a.position);
            const userRoles = sortedRoles.filter(r => !r.managed);
            const managedRoles = sortedRoles.filter(r => r.managed);
            const botCount = members.cache.filter(m => m.user.bot).size;

            const maxDisplayRoles = (roles, maxFieldLength = 1024) => {
                let total = 0, result = [];
                for (const role of roles) {
                    const str = `<@&${role.id}>`;
                    if (str.length + total > maxFieldLength) break;
                    total += str.length + 1;
                    result.push(str);
                }
                return result.length;
            };

            const splitPascal = (string, sep) => string.split(/(?=[A-Z])/).join(sep);
            const toPascalCase = (string, sep = false) => {
                const pascal = string.charAt(0).toUpperCase() + string.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
                return sep ? splitPascal(pascal, sep) : pascal;
            };
            const getChannelTypeSize = type => channels.cache.filter(ch => type.includes(ch.type)).size;

            const totalChannels = getChannelTypeSize([
                ChannelType.GuildText,
                ChannelType.GuildNews,
                ChannelType.GuildVoice,
                ChannelType.GuildStageVoice,
                ChannelType.GuildForum,
                ChannelType.GuildPublicThread,
                ChannelType.GuildPrivateThread,
                ChannelType.GuildNewsThread,
                ChannelType.GuildCategory
            ]);

            const embed = new EmbedBuilder()
                .setAuthor({ name: `Discord Server Info ${client.config.devBy}` })
                .setColor(members.me.roles.highest.hexColor)
                .setTitle(`${client.user.username} Server Info ${client.config.arrowEmoji}`)
                .setFooter({ text: `${guild.name} | ${guild.id}`, iconURL: guild.iconURL() })
                .setThumbnail(guild.iconURL({ size: 1024 }))
                .setImage(guild.bannerURL({ size: 1024 }))
                .addFields(
                    { name: "Description", value: `📝 ${guild.description || "None"}` },
                    {
                        name: "General",
                        value: [
                            `📜 **Created** <t:${parseInt(guild.createdTimestamp / 1000)}:R>`,
                            `💳 **ID** ${guild.id}`,
                            `👑 **Owner** <@${guild.ownerId}>`,
                            `🌍 **Language** ${new Intl.DisplayNames(["en"], { type: "language" }).of(guild.preferredLocale)}`,
                            `💻 **Vanity URL** ${guild.vanityURLCode || "None"}`
                        ].join("\n")
                    },
                    { name: "Features", value: guild.features?.map(f => `- ${toPascalCase(f, " ")}`)?.join("\n") || "None", inline: true },
                    {
                        name: "Security",
                        value: [
                            `👀 **Explicit Filter** ${splitPascal(GuildExplicitContentFilter[guild.explicitContentFilter], " ")}`,
                            `🔞 **NSFW Level** ${splitPascal(GuildNSFWLevel[guild.nsfwLevel], " ")}`,
                            `🔒 **Verification Level** ${splitPascal(GuildVerificationLevel[guild.verificationLevel], " ")}`
                        ].join("\n"),
                        inline: true
                    },
                    {
                        name: `Users (${guild.memberCount})`,
                        value: [
                            `👨‍👩‍👧‍👦 **Members** ${guild.memberCount - botCount}`,
                            `🤖 **Bots** ${botCount}`
                        ].join("\n"),
                        inline: true
                    },
                    { name: `User Roles (${maxDisplayRoles(userRoles)} of ${userRoles.length})`, value: `${userRoles.slice(0, maxDisplayRoles(userRoles)).join(" ") || "None"}`},
                    { name: `Managed Roles (${maxDisplayRoles(managedRoles)} of ${managedRoles.length})`, value: `${managedRoles.slice(0, maxDisplayRoles(managedRoles)).join(" ") || "None"}`},
                    {
                        name: `Channels, Threads & Categories (${totalChannels})`,
                        value: [
                            `💬 **Text** ${getChannelTypeSize([ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildNews])}`,
                            `🔊 **Voice** ${getChannelTypeSize([ChannelType.GuildVoice, ChannelType.GuildStageVoice])}`,
                            `🧵 **Threads** ${getChannelTypeSize([ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread, ChannelType.GuildNewsThread])}`,
                            `📑 **Categories** ${getChannelTypeSize([ChannelType.GuildCategory])}`
                        ].join("\n"),
                        inline: true
                    },
                    {
                        name: `Emojis & Stickers (${emojis.cache.size + stickers.cache.size})`,
                        value: [
                            `📺 **Animated** ${emojis.cache.filter(e => e.animated).size}`,
                            `🗿 **Static** ${emojis.cache.filter(e => !e.animated).size}`,
                            `🏷 **Stickers** ${stickers.cache.size}`
                        ].join("\n"),
                        inline: true
                    },
                    { 
                        name: "Nitro",
                        value: [
                            `📈 **Tier** ${guild.premiumTier || "None"}`,
                            `💪🏻 **Boosts** ${guild.premiumSubscriptionCount}`,
                            `💎 **Boosters** ${guild.members.cache.filter(m => m.roles.premiumSubscriberRole).size}`,
                            `🏋🏻‍♀️ **Total Boosters** ${guild.members.cache.filter(m => m.premiumSince).size}`
                        ].join("\n"),
                        inline: true
                    },
                    { name: "Banner", value: guild.bannerURL() ? "** **" : "None" }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // === FIVEM SERVER INFO ===
        if (sub === "fivem") {
            await interaction.deferReply();

            try {
                const basic = await FiveMAPI.getBasicInfo(SERVER_ID);
                const players = await FiveMAPI.getPlayers(SERVER_ID, 20);
                const resources = await FiveMAPI.getResources(SERVER_ID, 20);
                const vars = await FiveMAPI.getVariables(SERVER_ID);
                const perf = await FiveMAPI.getPerformance(SERVER_ID);

                if (!basic) {
                    return interaction.editReply("⚠️ Tidak bisa mengambil data FiveM server.");
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ name: `FiveM Server Info ${client.config.devBy}` })
                    .setColor("Green")
                    .setTitle(basic.hostname || "Unknown Server")
                    .setFooter({ text: `FiveM Server • ID: ${SERVER_ID}` })
                    .setTimestamp()
                    .addFields(
                        { name: "Players", value: `${basic.players}/${basic.maxPlayers}`, inline: true },
                        { name: "Endpoint", value: `\`${basic.ip || "N/A"}\``, inline: true },
                        { name: "Description", value: basic.description }
                    );

                if (players.length > 0) {
                    embed.addFields({
                        name: `Players Online (${players.length})`,
                        value: players.map(p => `• ${p.name} (${p.ping}ms)`).join("\n")
                    });
                }

                if (resources.length > 0) {
                    embed.addFields({
                        name: `Active Resources (${resources.length})`,
                        value: resources.join(", ").slice(0, 1000) + (resources.length > 20 ? "..." : "")
                    });
                }

                if (vars && Object.keys(vars).length > 0) {
                    embed.addFields({
                        name: "Server Variables",
                        value: Object.entries(vars)
                            .slice(0, 10)
                            .map(([k, v]) => `\`${k}\`: ${v}`)
                            .join("\n")
                    });
                }

                if (perf && Object.keys(perf).length > 0) {
                    embed.addFields({
                        name: "Performance",
                        value: [
                            `⚡ **Upvote Power**: ${perf.upvotePower ?? "N/A"}`,
                            `👤 **Owner ID**: ${perf.ownerID ?? "N/A"}`,
                            `🔄 **Fallback**: ${perf.fallback ?? "N/A"}`,
                            `💎 **Enhanced Host Support**: ${perf.enhancedHostSupport ?? "N/A"}`,
                            `📊 **Support Status**: ${perf.supportStatus ?? "N/A"}`,
                            `⏱ **Last Seen**: <t:${Math.floor(perf.lastSeen / 1000)}:R>`
                        ].join("\n")
                    });
                }

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                console.error("[FIVEM] Error:", err);
                return interaction.editReply("❌ Error saat fetch FiveM API.");
            }
        }
    }
};