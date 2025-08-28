const dotenv = require("dotenv");
const path = require("path");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");

// pilih file env sesuai mode
const envFile = process.env.NODE_ENV === "development" ? ".env.development" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

if (!clientId || !token) {
  console.error("❌ Missing CLIENT_ID or TOKEN in", envFile);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function clearAllCommands() {
  try {
    console.log("🧹 Starting command cleanup...");

    // Clear global commands
    console.log("📡 Clearing global commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("✅ Global commands cleared!");

    // Clear guild commands
    if (guildId) {
      console.log(`🏠 Clearing guild commands for ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      console.log("✅ Guild commands cleared!");
    }

    console.log("🎉 All commands cleared! You can now restart the bot.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error clearing commands:", error);
    process.exit(1);
  }
}

clearAllCommands();