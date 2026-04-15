require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const { iniciarFarmScheduler } = require("./tasks/farmScheduler");
const { iniciarAvisoScheduler } = require("./tasks/avisoScheduler");
const { iniciarResumoDiarioScheduler } = require("./tasks/resumoDiarioScheduler");
const { processarSaidaOuRetorno } = require("./utils/saidaMembro");
const { sincronizarPlanilhaFarm } = require("./utils/googleSheetsFarm");

const {
  REGISTRO_BUTTON_ID,
  REGISTRO_MODAL_ID,
  abrirModalRegistro,
  processarModalRegistro
} = require("./utils/registroMembro");

const {
  BAU_BUTTON_ENTRADA,
  BAU_BUTTON_SAIDA,
  BAU_BUTTON_TRANSFERIR,
  BAU_BUTTON_VER,
  BAU_SELECT_CATEGORIA,
  BAU_SELECT_ITEM,
  BAU_BUTTON_VOLTAR,
  BAU_BUTTON_CANCELAR,
  BAU_BUTTON_CONFIRMAR,
  BAU_MODAL_QUANTIDADE,
  abrirSelecaoEntradaBau,
  abrirSelecaoSaidaBau,
  abrirSelecaoTransferirBau,
  processarSelecaoBauGerencia,
  processarModalBauGerencia,
  processarBotaoBauGerencia,
  verEstoqueBauGerencia
} = require("./utils/painelBau");

const {
  CONTROLE_BUTTON_RETIRAR,
  CONTROLE_BUTTON_DEVOLVER,
  CONTROLE_BUTTON_VER,
  CONTROLE_SELECT_CATEGORIA,
  CONTROLE_SELECT_ITEM,
  CONTROLE_BUTTON_VOLTAR,
  CONTROLE_BUTTON_CANCELAR,
  CONTROLE_BUTTON_CONFIRMAR,
  CONTROLE_MODAL_QUANTIDADE,
  abrirSelecaoRetirar,
  abrirSelecaoDevolver,
  processarSelecaoControleBau,
  processarModalControleBau,
  processarBotaoControleBau,
  verEstoqueControleBau
} = require("./utils/painelControleBau");

const {
  FARM_BUTTON_REGISTRAR,
  FARM_MODAL_REGISTRAR,
  abrirModalFarm,
  processarMensagemComprovanteFarm,
  processarModalFarm
} = require("./utils/painelFarm");

const {
  AVISO_BUTTON_AGORA,
  AVISO_BUTTON_AGENDAR,
  AVISO_SELECT_MENCAO_PREFIX,
  AVISO_SELECT_DIA_PREFIX,
  AVISO_SELECT_HORA_PREFIX,
  AVISO_MODAL_AGORA_PREFIX,
  AVISO_MODAL_AGENDAR_PREFIX,
  abrirModalAvisoAgora,
  abrirModalAvisoAgendar,
  processarSelectMencao,
  processarSelectDia,
  processarSelectHora,
  enviarAvisoAgora,
  agendarAviso
} = require("./utils/painelAvisos");

const ajusteGerenciaCommand = require("./commands/ajuste-gerencia");
const removerRegistroDinheiroSujoCommand = require("./commands/remover-registro-dinheiro-sujo");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const command = require(filePath);

      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar ${file}:`, error);
    }
  }
}

client.once("clientReady", async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  iniciarFarmScheduler(client);
  iniciarAvisoScheduler(client);
  iniciarResumoDiarioScheduler(client);

  try {
    const guildId = process.env.GUILD_ID;
    const guild = guildId
      ? await client.guilds.fetch(guildId).catch(() => null)
      : client.guilds.cache.first() || null;

    if (guild) {
      await sincronizarPlanilhaFarm(guild);
      console.log("✅ Planilha do farm sincronizada na inicialização.");
    }
  } catch (error) {
    console.error("Erro ao sincronizar planilha na inicialização:", error);
  }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    await processarSaidaOuRetorno(oldMember, newMember);
  } catch (error) {
    console.error("❌ Erro no guildMemberUpdate:", error);
  }
});

client.on("messageCreate", async (message) => {
  try {
    await processarMensagemComprovanteFarm(message);
  } catch (error) {
    console.error("❌ Erro no messageCreate:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === REGISTRO_BUTTON_ID) {
        await abrirModalRegistro(interaction);
        return;
      }

      if (interaction.customId === BAU_BUTTON_ENTRADA) {
        await abrirSelecaoEntradaBau(interaction);
        return;
      }

      if (interaction.customId === BAU_BUTTON_SAIDA) {
        await abrirSelecaoSaidaBau(interaction);
        return;
      }

      if (interaction.customId === BAU_BUTTON_TRANSFERIR) {
        await abrirSelecaoTransferirBau(interaction);
        return;
      }

      if (interaction.customId === BAU_BUTTON_VER) {
        await verEstoqueBauGerencia(interaction);
        return;
      }

      if (
        interaction.customId.startsWith(`${BAU_BUTTON_VOLTAR}:`) ||
        interaction.customId.startsWith(`${BAU_BUTTON_CANCELAR}:`) ||
        interaction.customId.startsWith(`${BAU_BUTTON_CONFIRMAR}:`)
      ) {
        await processarBotaoBauGerencia(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_BUTTON_RETIRAR) {
        await abrirSelecaoRetirar(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_BUTTON_DEVOLVER) {
        await abrirSelecaoDevolver(interaction);
        return;
      }

      if (interaction.customId === CONTROLE_BUTTON_VER) {
        await verEstoqueControleBau(interaction);
        return;
      }

      if (
        interaction.customId.startsWith(`${CONTROLE_BUTTON_VOLTAR}:`) ||
        interaction.customId.startsWith(`${CONTROLE_BUTTON_CANCELAR}:`) ||
        interaction.customId.startsWith(`${CONTROLE_BUTTON_CONFIRMAR}:`)
      ) {
        await processarBotaoControleBau(interaction);
        return;
      }

      if (interaction.customId === FARM_BUTTON_REGISTRAR) {
        await abrirModalFarm(interaction);
        return;
      }

      if (interaction.customId === AVISO_BUTTON_AGORA) {
        await abrirModalAvisoAgora(interaction);
        return;
      }

      if (interaction.customId === AVISO_BUTTON_AGENDAR) {
        await abrirModalAvisoAgendar(interaction);
        return;
      }

      if (interaction.customId === "ajusteFarmCancelar") {
        await interaction.update({
          content: "❌ Ajuste cancelado.",
          embeds: [],
          components: []
        });
        return;
      }

      if (interaction.customId.startsWith("ajusteFarm:")) {
        await ajusteGerenciaCommand.confirmarAjusteFarm(interaction, client);
        return;
      }

      if (
        interaction.customId.startsWith(`${removerRegistroDinheiroSujoCommand.REMOVER_REGISTRO_CONFIRM_PREFIX}:`) ||
        interaction.customId.startsWith(`${removerRegistroDinheiroSujoCommand.REMOVER_REGISTRO_CANCEL_PREFIX}:`)
      ) {
        await removerRegistroDinheiroSujoCommand.handleButton(interaction);
        return;
      }

      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (
        interaction.customId.startsWith(`${BAU_SELECT_CATEGORIA}:`) ||
        interaction.customId.startsWith(`${BAU_SELECT_ITEM}:`)
      ) {
        await processarSelecaoBauGerencia(interaction, client);
        return;
      }

      if (
        interaction.customId.startsWith(`${CONTROLE_SELECT_CATEGORIA}:`) ||
        interaction.customId.startsWith(`${CONTROLE_SELECT_ITEM}:`)
      ) {
        await processarSelecaoControleBau(interaction);
        return;
      }

      if (interaction.customId.startsWith(`${AVISO_SELECT_MENCAO_PREFIX}:`)) {
        await processarSelectMencao(interaction);
        return;
      }

      if (interaction.customId.startsWith(`${AVISO_SELECT_DIA_PREFIX}:`)) {
        await processarSelectDia(interaction);
        return;
      }

      if (interaction.customId.startsWith(`${AVISO_SELECT_HORA_PREFIX}:`)) {
        await processarSelectHora(interaction);
        return;
      }

      if (interaction.customId.startsWith(`${removerRegistroDinheiroSujoCommand.REMOVER_REGISTRO_SELECT_PREFIX}:`)) {
        await removerRegistroDinheiroSujoCommand.handleSelectMenu(interaction);
        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === REGISTRO_MODAL_ID) {
        await processarModalRegistro(interaction);
        return;
      }

      if (interaction.customId.startsWith(`${BAU_MODAL_QUANTIDADE}:`)) {
        await processarModalBauGerencia(interaction, client);
        return;
      }

      if (interaction.customId.startsWith(`${CONTROLE_MODAL_QUANTIDADE}:`)) {
        await processarModalControleBau(interaction);
        return;
      }

      if (interaction.customId === FARM_MODAL_REGISTRAR) {
        await processarModalFarm(interaction);
        return;
      }

      if (interaction.customId.startsWith(`${AVISO_MODAL_AGORA_PREFIX}:`)) {
        await enviarAvisoAgora(interaction);
        return;
      }

      if (interaction.customId.startsWith(`${AVISO_MODAL_AGENDAR_PREFIX}:`)) {
        await agendarAviso(interaction);
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