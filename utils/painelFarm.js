const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const FarmRegistro = require("../models/FarmRegistro");
const FarmPendente = require("../models/FarmPendente");
const getSemanaRP = require("./semanaRP");
const logFarm = require("./logFarm");

const FARM_BUTTON_REGISTRAR = "farm_registrar";
const FARM_MODAL_REGISTRAR = "farm_modal_registrar";

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function criarPainelFarm() {
  const embed = new EmbedBuilder()
    .setTitle("💸 Painel de Registro de Farm")
    .setDescription(
      [
        "Use o botão abaixo para registrar seu farm semanal.",
        "",
        "Fluxo:",
        "• informar o valor",
        "• depois enviar a foto do comprovante neste canal"
      ].join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(FARM_BUTTON_REGISTRAR)
      .setLabel("Registrar farm")
      .setEmoji("💸")
      .setStyle(ButtonStyle.Success)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function criarModalFarm() {
  const modal = new ModalBuilder()
    .setCustomId(FARM_MODAL_REGISTRAR)
    .setTitle("Registrar farm semanal");

  const valorInput = new TextInputBuilder()
    .setCustomId("valor")
    .setLabel("Valor do farm")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 100000")
    .setRequired(true)
    .setMaxLength(20);

  modal.addComponents(
    new ActionRowBuilder().addComponents(valorInput)
  );

  return modal;
}

async function abrirModalFarm(interaction) {
  await interaction.showModal(criarModalFarm());
}

async function processarModalFarm(interaction) {
  const valorTexto = interaction.fields.getTextInputValue("valor").trim();
  const valor = Number(valorTexto.replace(/\./g, "").replace(",", "."));

  if (!Number.isFinite(valor) || valor <= 0) {
    return interaction.reply({
      content: "❌ Valor inválido. Informe apenas números.",
      flags: 64
    });
  }

  const semana = getSemanaRP();
  const expiraEm = new Date(Date.now() + 10 * 60 * 1000);

  await FarmPendente.findOneAndUpdate(
    { userId: interaction.user.id },
    {
      userId: interaction.user.id,
      username: interaction.user.username,
      valor,
      semanaId: semana.semanaId,
      canalId: interaction.channel.id,
      criadoEm: new Date(),
      expiraEm
    },
    {
      upsert: true,
      new: true
    }
  );

  return interaction.reply({
    content: [
      "✅ Valor recebido.",
      `💰 Valor informado: **${formatMoney(valor)}**`,
      "📸 Agora envie a **foto do comprovante neste canal** em até 10 minutos."
    ].join("\n"),
    flags: 64
  });
}

async function processarMensagemComprovanteFarm(message, client) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const pendente = await FarmPendente.findOne({
      userId: message.author.id
    });

    if (!pendente) return;

    if (pendente.canalId !== message.channel.id) {
      return;
    }

    if (new Date() > new Date(pendente.expiraEm)) {
      await FarmPendente.deleteOne({ _id: pendente._id });

      await message.reply(
        "⏰ Seu registro de farm expirou. Clique no botão novamente e refaça o processo."
      );

      return;
    }

    const anexo = message.attachments.find((attachment) => {
      const contentType = attachment.contentType || "";
      return contentType.startsWith("image/");
    });

    if (!anexo) {
      await message.reply("❌ Envie uma **imagem** como comprovante do farm.");
      return;
    }

    await FarmRegistro.create({
      userId: pendente.userId,
      username: pendente.username,
      cargo: "membro",
      valor: pendente.valor,
      comprovante: anexo.url,
      semanaId: pendente.semanaId,
      registradoEm: new Date()
    });

    const registros = await FarmRegistro.find({
      userId: pendente.userId,
      semanaId: pendente.semanaId
    });

    const totalSemana = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

    await logFarm(client, {
      username: pendente.username,
      userId: pendente.userId,
      valor: pendente.valor,
      totalSemana,
      semanaId: pendente.semanaId,
      comprovante: anexo.url,
      canalNome: message.channel.name
    });

    await FarmPendente.deleteOne({ _id: pendente._id });

    await message.reply(
      [
        "✅ Farm registrado com sucesso.",
        `💰 Valor enviado: **${formatMoney(pendente.valor)}**`,
        `📊 Total da semana: **${formatMoney(totalSemana)}**`
      ].join("\n")
    );
  } catch (error) {
    console.error("Erro ao processar comprovante de farm:", error);
  }
}

module.exports = {
  FARM_BUTTON_REGISTRAR,
  FARM_MODAL_REGISTRAR,
  abrirModalFarm,
  criarPainelFarm,
  processarMensagemComprovanteFarm,
  processarModalFarm
};