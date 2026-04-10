require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { iniciarFarmScheduler } = require("./tasks/farmScheduler");

const {
  REGISTRO_BUTTON_ID,
  REGISTRO_MODAL_ID,
  abrirModalRegistro,
  processarModalRegistro
} = require("./utils/registroMembro");

const {
  BAU_BUTTON_ENTRADA,
  BAU_BUTTON_SAIDA,
  BAU_BUTTON_VER,
  BAU_MODAL_ENTRADA,
  BAU_MODAL_SAIDA,
  abrirModalBauEntrada,
  abrirModalBauSaida,
  processarModalBauEntrada,
  processarModalBauSaida,
  verEstoqueBauGerencia
} = require("./utils/painelBau");

const {
  CONTROLE_BUTTON_LIBERAR,
  CONTROLE_BUTTON_RETIRAR,
  CONTROLE_BUTTON_DEVOLVER,
  CONTROLE_BUTTON_VER,
  CONTROLE_MODAL_LIBERAR,
  CONTROLE_MODAL_RETIRAR,
  CONTROLE_MODAL_DEVOLVER,
  abrirModalLiberar,
  abrirModalRetirar,
  abrirModalDevolver,
  processarModalLiberar,
  processarModalRetirar,
  processarModalDevolver,
  verEstoqueControleBau
} = require("./utils/painelControleBau");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

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

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      console.log(`🔘 Botão clicado: ${interaction.customId} por ${interaction.user.tag}`);

      if (interaction.customId === REGISTRO_BUTTON_ID) {
        await abrirModalRegistro(interaction);
        return;
      }

      if (interaction.customId === BAU_BUTTON_ENTRADA) {
        await abrirModalBauEntrada(interaction);
        return;
      }

      if (interaction.customId === BAU_BUTTON_SAIDA) {
        await abrirModalBauSaida(interaction);
        return;
      }

      if (interaction.customId === BAU_BUTTON_VER) {
        await verEstoqueBauGerencia(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_BUTTON_LIBERAR) {
        await abrirModalLiberar(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_BUTTON_RETIRAR) {
        await abrirModalRetirar(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_BUTTON_DEVOLVER) {
        await abrirModalDevolver(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_BUTTON_VER) {
        await verEstoqueControleBau(interaction);
        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      console.log(`📝 Modal enviado: ${interaction.customId} por ${interaction.user.tag}`);

      if (interaction.customId === REGISTRO_MODAL_ID) {
        await processarModalRegistro(interaction);
        return;
      }

      if (interaction.customId === BAU_MODAL_ENTRADA) {
        await processarModalBauEntrada(interaction);
        return;
      }

      if (interaction.customId === BAU_MODAL_SAIDA) {
        await processarModalBauSaida(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_MODAL_LIBERAR) {
        await processarModalLiberar(interaction, client);
        return;
      }

      if (interaction.customId === CONTROLE_MODAL_RETIRAR) {
        await processarModalRetirar(interaction, client);
        return;
      }

      if (interaction.customId === CONTROLE_MODAL_DEVOLVER) {
        await processarModalDevolver(interaction, client);
        return;
      }

      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    await command.execute(interaction, client);
  } catch (error) {
    console.error("❌ Erro no interactionCreate:", error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Ocorreu um erro ao processar essa ação.",
        flags: 64
      }).catch(() => null);
    } else {
      await interaction.reply({
        content: "❌ Ocorreu um erro ao processar essa ação.",
        flags: 64
      }).catch(() => null);
    }
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB conectado");
    client.login(process.env.DISCORD_TOKEN);
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar no MongoDB:", err);
  });