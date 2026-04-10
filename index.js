require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { iniciarFarmScheduler } = require("./tasks/farmScheduler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }
}

client.once("clientReady", async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  iniciarFarmScheduler(client);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Deu erro ao executar o comando.",
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: "❌ Deu erro ao executar o comando.",
        ephemeral: true
      });
    }
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB conectado");
    client.login(process.env.DISCORD_TOKEN);
  })
  .catch(err => {
    console.error("❌ Erro ao conectar no MongoDB:", err);
  });