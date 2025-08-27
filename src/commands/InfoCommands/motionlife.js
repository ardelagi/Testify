const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const FiveMAPI = require("../../api/fivemApi");

module.exports = {
    category: "InfoCommands",
    data: new SlashCommandBuilder()
        .setName("motionlife")
        .setDescription("Menampilkan semua data server FiveM"),

    async execute(interaction) {
        await interaction.deferReply();
        const serverId = "5j433z";

        const basic = await FiveMAPI.getBasicInfo(serverId);
        const players = await FiveMAPI.getPlayers(serverId, 15);
        const resources = await FiveMAPI.getResources(serverId, 15);
        const vars = await FiveMAPI.getVariables(serverId);
        const perf = await FiveMAPI.getPerformance(serverId);

        if (!basic) return interaction.editReply("⚠️ Gagal mengambil data server.");

        const embed = new EmbedBuilder()
            .setTitle(basic.hostname)
            .setDescription(basic.description)
            .setColor(0x00ff00)
            .addFields(
                { name: "👥 Players", value: `${basic.players}/${basic.maxPlayers}`, inline: true },
                { name: "🌍 Connect", value: `F8 → \`connect ${basic.ip}\``, inline: true },
                { name: "💬 Discord", value: vars.Discord1 || "Tidak ada", inline: true },
                { name: "📝 Player List", value: players.length > 0 ? players.map(p => `• ${p.name} (${p.ping}ms)`).join("\n").substring(0, 1000) : "No players online" },
                { name: "⚙️ Resources", value: resources.length > 0 ? resources.join(", ").substring(0, 1000) : "Tidak ada", inline: false },
                { name: "📌 Vars", value: Object.entries(vars).slice(0, 10).map(([k, v]) => `• **${k}**: ${v}`).join("\n").substring(0, 1000) || "Tidak ada" },
                { name: "📊 Performance", value: `UpvotePower: ${perf.upvotePower}\nLastSeen: ${perf.lastSeen}` }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};