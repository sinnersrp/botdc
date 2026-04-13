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
const { sincronizarPlanilhaFarm } = require("./googleSheetsFarm");

const FARM_BUTTON_REGISTRAR = "farm_registrar";
const FARM_MODAL_REGISTRAR = "farm_modal_registrar";
const META_SEMANAL = 100000;

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function criarPainelFarm() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("💸 Painel de Farm")
    .setDescription(
      [
        "Use este painel para registrar seu farm semanal.",
        "",
        "**Como funciona:**",
        "• clique em **Registrar farm**",
        "• informe o valor",
        "• depois envie a **foto do comprovante** no canal",
        "",
        "O bot vai registrar automaticamente."
      ].join("\n")
    )
    .setFooter({
      text: "SINNERS BOT • Farm"
    })
    .setTimestamp();

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

  const valor = new TextInputBuilder()
    .setCustomId("valor")
    .setLabel("Valor do farm")
    .setPlaceholder("Ex: 100000")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  modal.addComponents(new ActionRowBuilder().addComponents(valor));
  return modal;
}

async function abrirModalFarm(interaction) {
  await interaction.showModal(criarModalFarm());
}

async function processarModalFarm(interaction) {
  const valorBruto = interaction.fields.getTextInputValue("valor").trim();
  const valor = Number(valorBruto.replace(/\./g, "").replace(",", "."));

  if (!Number.isFinite(valor) || valor <= 0) {
    return interaction.reply({
      content: "❌ Valor inválido. Informe um número maior que zero.",
      flags: 64
    });
  }

  await FarmPendente.findOneAndDelete({
    userId: interaction.user.id,
    channelId: interaction.channel.id
  }).catch(() => null);

  await FarmPendente.create({
    userId: interaction.user.id,
    username: interaction.user.username,
    channelId: interaction.channel.id,
    valor,
    criadoEm: new Date()
  });

  return interaction.reply({
    content: [
      "📸 Agora envie a **foto do comprovante** neste canal para concluir o registro.",
      `💰 Valor informado: **${formatMoney(valor)}**`
    ].join("\n"),
    flags: 64
  });
}

async function processarMensagemComprovanteFarm(message, client) {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.attachments || !message.attachments.size) return;

  const pendente = await FarmPendente.findOne({
    userId: message.author.id,
    channelId: message.channel.id
  });

  if (!pendente) return;

  const anexo = message.attachments.first();
  const { semanaId } = getSemanaRP();

  const cargo = "membro";

  await FarmRegistro.create({
    userId: message.author.id,
    username: message.author.username,
    cargo,
    valor: pendente.valor,
    comprovante: anexo?.url || "Sem comprovante",
    semanaId,
    registradoEm: new Date()
  });

  const registrosSemana = await FarmRegistro.find({
    userId: message.author.id,
    semanaId
  });

  const totalSemana = registrosSemana.reduce(
    (acc, item) => acc + (Number(item.valor) || 0),
    0
  );

  const excedente = Math.max(0, totalSemana - META_SEMANAL);
  const valorLimpo = Math.floor(excedente * 0.5);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Farm registrado com sucesso")
    .addFields(
      {
        name: "💰 Valor enviado",
        value: `**${formatMoney(pendente.valor)}**`,
        inline: true
      },
      {
        name: "📊 Total da semana",
        value: `**${formatMoney(totalSemana)}**`,
        inline: true
      },
      {
        name: "🗓️ Semana",
        value: `**${semanaId}**`,
        inline: false
      },
      {
        name: "📈 Excedente",
        value: `**${formatMoney(excedente)}**`,
        inline: true
      },
      {
        name: "💵 Valor limpo estimado",
        value: `**${formatMoney(valorLimpo)}**`,
        inline: true
      }
    )
    .setImage(anexo?.url || null)
    .setFooter({
      text: "SINNERS BOT • Farm"
    })
    .setTimestamp();

  await message.channel.send({
    embeds: [embed]
  });

  await FarmPendente.deleteOne({ _id: pendente._id });

  await sincronizarPlanilhaFarm(message.guild).catch((error) => {
    console.error("Erro ao sincronizar planilha após registro de farm:", error);
  });
}

module.exports = {
  FARM_BUTTON_REGISTRAR,
  FARM_MODAL_REGISTRAR,
  abrirModalFarm,
  criarPainelFarm,
  processarMensagemComprovanteFarm,
  processarModalFarm
};