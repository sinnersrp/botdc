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
const { sincronizarCaixaFaccao } = require("./financeiroFaccao");

const FARM_BUTTON_REGISTRAR = "farm_registrar";
const FARM_MODAL_REGISTRAR = "farm_modal_registrar";
const META_SEMANAL = 100000;

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function criarPainelFarm() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("💸 Painel de Dinheiro Sujo")
    .setDescription(
      [
        "Use este painel para registrar seu dinheiro sujo semanal.",
        "",
        "**Como funciona:**",
        "• clique em **Registrar dinheiro sujo**",
        "• informe o valor",
        "• depois envie a **foto do comprovante** no canal",
        "",
        "O bot vai registrar automaticamente."
      ].join("\n")
    )
    .setFooter({
      text: "SINNERS BOT • Dinheiro sujo"
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(FARM_BUTTON_REGISTRAR)
      .setLabel("Registrar dinheiro sujo")
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
    .setTitle("Registrar dinheiro sujo");

  const valor = new TextInputBuilder()
    .setCustomId("valor")
    .setLabel("Valor do dinheiro sujo")
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
  const { semanaId } = getSemanaRP();

  if (!Number.isFinite(valor) || valor <= 0) {
    return interaction.reply({
      content: "❌ Valor inválido. Informe um número maior que zero.",
      flags: 64
    });
  }

  await FarmPendente.findOneAndDelete({
    userId: interaction.user.id,
    canalId: interaction.channel.id
  }).catch(() => null);

  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + 10 * 60 * 1000);

  await FarmPendente.create({
    userId: interaction.user.id,
    username: interaction.user.username,
    canalId: interaction.channel.id,
    semanaId,
    valor,
    criadoEm: agora,
    expiraEm
  });

  return interaction.reply({
    content: [
      "📸 Agora envie a **foto do comprovante** neste canal para concluir o registro.",
      `💰 Valor informado: **R$ ${formatMoney(valor)}**`,
      "⏳ Esse registro pendente expira em **10 minutos**."
    ].join("\n"),
    flags: 64
  });
}

async function processarMensagemComprovanteFarm(message) {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.attachments || !message.attachments.size) return;

  const pendente = await FarmPendente.findOne({
    userId: message.author.id,
    canalId: message.channel.id
  });

  if (!pendente) return;

  const anexo = message.attachments.first();
  const semanaId = pendente.semanaId;
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

  await sincronizarCaixaFaccao().catch((error) => {
    console.error("Erro ao sincronizar caixa após registro:", error);
  });

  await sincronizarPlanilhaFarm(message.guild).catch((error) => {
    console.error("Erro ao sincronizar planilha após registro:", error);
  });

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Dinheiro sujo registrado com sucesso")
    .addFields(
      {
        name: "💰 Valor enviado",
        value: `**R$ ${formatMoney(pendente.valor)}**`,
        inline: true
      },
      {
        name: "📊 Total da semana",
        value: `**R$ ${formatMoney(totalSemana)}**`,
        inline: true
      },
      {
        name: "🗓️ Semana",
        value: `**${semanaId}**`,
        inline: false
      },
      {
        name: "📈 Excedente",
        value: `**R$ ${formatMoney(excedente)}**`,
        inline: true
      },
      {
        name: "🧼 Valor limpo estimado",
        value: `**R$ ${formatMoney(valorLimpo)}**`,
        inline: true
      }
    )
    .setImage(anexo?.url || null)
    .setFooter({
      text: "SINNERS BOT • Dinheiro sujo"
    })
    .setTimestamp();

  await message.channel.send({
    embeds: [embed]
  });

  await FarmPendente.deleteOne({ _id: pendente._id });
}

module.exports = {
  FARM_BUTTON_REGISTRAR,
  FARM_MODAL_REGISTRAR,
  abrirModalFarm,
  criarPainelFarm,
  processarMensagemComprovanteFarm,
  processarModalFarm
};