const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  GuildVerificationLevel,
  GuildExplicitContentFilter,
  GuildNSFWLevel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const FiveMAPI = require("../../api/fivemApi");

const SERVER_ID = "main.motionliferp.com:30120"; // domain:port server

module.exports = {
  usableInDms: false,
  category: "Info",
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Get server info (Discord / FiveM).")
    .addSubcommand(sub =>
      sub.setName("discord").setDescription("Displays information about this Discord server.")
    )
    .addSubcommand(sub =>
      sub.setName("fivem").setDescription("Displays information about the FiveM server.")
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // ================== DISCORD INFO ==================
    if (sub === "discord") {
      const { guild } = interaction;
      const { members, channels, emojis, roles, stickers } = guild;

      const sortedRoles = roles.cache.map(role => role).slice(1, roles.cache.size).sort((a, b) => b.position - a.position);
      const userRoles = sortedRoles.filter(role => !role.managed);
      const managedRoles = sortedRoles.filter(role => role.managed);
      const botCount = members.cache.filter(member => member.user.bot).size;

      const maxDisplayRoles = (roles, maxFieldLength = 1024) => {
        let totalLength = 0;
        const result = [];
        for (const role of roles) {
          const roleString = `<@&${role.id}>`;
          if (roleString.length + totalLength > maxFieldLength) break;
          totalLength += roleString.length + 1;
          result.push(roleString);
        }
        return result.length;
      };

      const splitPascal = (string, separator) => string.split(/(?=[A-Z])/).join(separator);
      const toPascalCase = (string, separator = false) => {
        const pascal = string.charAt(0).toUpperCase() + string.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase());
        return separator ? splitPascal(pascal, separator) : pascal;
      };

      const getChannelTypeSize = type => channels.cache.filter(channel => type.includes(channel.type)).size;
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
        .setAuthor({ name: `Server Info Command ${client.config.devBy}` })
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
              `💻 **Vanity URL** ${guild.vanityURLCode || "None"}`,
            ].join("\n")
          },
          { name: "Features", value: guild.features?.map(feature => `- ${toPascalCase(feature, " ")}`)?.join("\n") || "None", inline: true },
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
          { name: `User Roles (${maxDisplayRoles(userRoles)} of ${userRoles.length})`, value: `${userRoles.slice(0, maxDisplayRoles(userRoles)).join(" ") || "None"}` },
          { name: `Managed Roles (${maxDisplayRoles(managedRoles)} of ${managedRoles.length})`, value: `${managedRoles.slice(0, maxDisplayRoles(managedRoles)).join(" ") || "None"}` },
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
              `📺 **Animated** ${emojis.cache.filter(emoji => emoji.animated).size}`,
              `🗿 **Static** ${emojis.cache.filter(emoji => !emoji.animated).size}`,
              `🏷 **Stickers** ${stickers.cache.size}`
            ].join("\n"),
            inline: true
          },
          {
            name: "Nitro",
            value: [
              `📈 **Tier** ${guild.premiumTier || "None"}`,
              `💪🏻 **Boosts** ${guild.premiumSubscriptionCount}`,
              `💎 **Boosters** ${guild.members.cache.filter(member => member.roles.premiumSubscriberRole).size}`,
              `🏋🏻‍♀️ **Total Boosters** ${guild.members.cache.filter(member => member.premiumSince).size}`
            ].join("\n"),
            inline: true
          },
          { name: "Banner", value: guild.bannerURL() ? "** **" : "None" }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ================== FIVEM INFO ==================
    if (sub === "fivem") {
      await interaction.deferReply();

      const data = await FiveMAPI.getAll(SERVER_ID);
      if (!data) return interaction.editReply("⚠️ Tidak bisa mengambil data FiveM server.");

      const players = data.playersList || [];
      const pageSize = 50; 
      let currentPage = 0;

      const generateEmbed = (page) => {
        const start = page * pageSize;
        const end = start + pageSize;
        const pagePlayers = players.slice(start, end).map(p => `• ${p.name} (ping: ${p.ping})`).join("\n") || "No players online";

        return new EmbedBuilder()
          .setAuthor({ name: `FiveM Server Info ${client.config.devBy}` })
          .setColor(client.config.embedColor || 0x2f3136)
          .setTitle(`${data.hostname || "Unknown Server"}`)
          .setDescription(data.vars?.sv_projectDesc || "No description")
          .addFields(
            { name: "IP / Connect", value: data.ip || SERVER_ID, inline: true },
            { name: "Players", value: `${data.players}/${data.maxPlayers}`, inline: true },
            { name: "Resources", value: `${data.resources?.length || 0} resources`, inline: true },
            { name: "Performance", value: `Ping: ${data.ping || "N/A"}ms\nLast Seen: <t:${Math.floor((data.performance?.lastSeen || 0) / 1000)}:R>` },
            { name: `Players Online (Page ${page + 1}/${Math.ceil(players.length / pageSize) || 1})`, value: pagePlayers }
          )
          .setTimestamp();
      };

      const getRow = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("◀️ Prev").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId("next").setLabel("Next ▶️").setStyle(ButtonStyle.Secondary).setDisabled((currentPage + 1) * pageSize >= players.length)
      );

      const message = await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: [getRow()]
      });

      const collector = message.createMessageComponentCollector({ time: 60_000 });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return i.reply({ content: "❌ Kamu tidak bisa pakai tombol ini.", ephemeral: true });

        if (i.customId === "prev" && currentPage > 0) currentPage--;
        if (i.customId === "next" && (currentPage + 1) * pageSize < players.length) currentPage++;

        await i.update({ embeds: [generateEmbed(currentPage)], components: [getRow()] });
      });

      collector.on("end", async () => {
        await message.edit({ components: [] }).catch(() => {});
      });
    }
  }
};