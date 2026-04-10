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
        "Você poderá informar:",
        "• Valor do farm",
        "• Comprovante (link opcional)"
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

  const comprovanteInput = new TextInputBuilder()
    .setCustomId("comprovante")
    .setLabel("Comprovante (link opcional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://...")
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(valorInput),
    new ActionRowBuilder().addComponents(comprovanteInput)
  );

  return modal;
}

async function abrirModalFarm(interaction) {
  await interaction.showModal(criarModalFarm());
}

async function processarModalFarm(interaction, client) {
  const valorTexto = interaction.fields.getTextInputValue("valor").trim();
  const comprovante = interaction.fields.getTextInputValue("comprovante").trim();

  const valor = Number(valorTexto.replace(/\./g, "").replace(",", "."));

  if (!Number.isFinite(valor) || valor <= 0) {
    return interaction.reply({
      content: "❌ Valor inválido. Informe apenas números.",
      flags: 64
    });
  }

  const semana = getSemanaRP();

  await FarmRegistro.create({
    userId: interaction.user.id,
    username: interaction.user.username,
    cargo: "Membro",
    valor,
    comprovante,
    semanaId: semana.semanaId,
    registradoEm: new Date()
  });

  const registros = await FarmRegistro.find({
    userId: interaction.user.id,
    semanaId: semana.semanaId
  });

  const totalSemana = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

  await logFarm(client, {
    username: interaction.user.username,
    userId: interaction.user.id,
    valor,
    totalSemana,
    semanaId: semana.semanaId,
    comprovante,
    canalNome: interaction.channel.name
  });

  return interaction.reply({
    content: [
      "✅ Farm registrado com sucesso.",
      `💰 Valor enviado: **${formatMoney(valor)}**`,
      `📊 Total da semana: **${formatMoney(totalSemana)}**`
    ].join("\n"),
    flags: 64
  });
}

module.exports = {
  FARM_BUTTON_REGISTRAR,
  FARM_MODAL_REGISTRAR,
  abrirModalFarm,
  criarPainelFarm,
  processarModalFarm
};