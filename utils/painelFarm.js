const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");

const crypto = require("crypto");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("./semanaRP");
const { sincronizarPlanilhaFarm } = require("./googleSheetsFarm");
const { podeUsarFarm } = require("./permissoes");

const FARM_BUTTON_REGISTRAR = "farm_registrar";

const FARM_BUTTON_VOLTAR = "farm_voltar";
const FARM_BUTTON_CANCELAR = "farm_cancelar";
const FARM_BUTTON_CONFIRMAR = "farm_confirmar";

const FARM_MODAL_REGISTRAR = "farm_modal_registrar";

const sessoesFarm = new Map();
const aguardandoComprovante = new Map();

function gerarToken() {
  return crypto.randomBytes(8).toString("hex");
}

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
        "**Fluxo:**",
        "1. informar valor",
        "2. confirmar",
        "3. enviar comprovante no canal",
        "",
        "Agora com:",
        "• voltar",
        "• cancelar",
        "• confirmar"
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Dinheiro Sujo" })
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

function criarEmbedConfirmacao(sessao) {
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("✅ Confirmar registro de dinheiro sujo")
    .setDescription(
      [
        `Valor: **R$ ${formatMoney(sessao.valor)}**`,
        `Semana: **${sessao.semanaId}**`,
        "",
        "Depois de confirmar, envie a **foto do comprovante** neste canal."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Confirmação" })
    .setTimestamp();
}

function criarBotoesNavegacao(token, podeConfirmar = false) {
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${FARM_BUTTON_CANCELAR}:${token}`)
      .setLabel("Cancelar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary)
  );

  if (podeConfirmar) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${FARM_BUTTON_CONFIRMAR}:${token}`)
        .setLabel("Confirmar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );
  }

  return row;
}

async function abrirModalFarm(interaction) {
  if (!podeUsarFarm(interaction.member, interaction.channel)) {
    return interaction.reply({
      content: "❌ Você não pode registrar dinheiro sujo neste canal.",
      flags: 64
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(FARM_MODAL_REGISTRAR)
    .setTitle("Registrar dinheiro sujo");

  const valorInput = new TextInputBuilder()
    .setCustomId("valor")
    .setLabel("Valor")
    .setPlaceholder("Ex: 50000")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(15);

  modal.addComponents(
    new ActionRowBuilder().addComponents(valorInput)
  );

  return interaction.showModal(modal);
}

async function processarModalFarm(interaction) {
  if (!podeUsarFarm(interaction.member, interaction.channel)) {
    return interaction.reply({
      content: "❌ Você não pode registrar dinheiro sujo neste canal.",
      flags: 64
    });
  }

  const valorBruto = interaction.fields.getTextInputValue("valor");
  const valor = Number(String(valorBruto).replace(/[^\d]/g, ""));

  if (!Number.isInteger(valor) || valor <= 0) {
    return interaction.reply({
      content: "❌ Valor inválido. Informe um número inteiro maior que zero.",
      flags: 64
    });
  }

  const semana = getSemanaRP();
  const token = gerarToken();

  sessoesFarm.set(token, {
    token,
    userId: interaction.user.id,
    channelId: interaction.channelId,
    valor,
    semanaId: semana.semanaId
  });

  return interaction.reply({
    embeds: [criarEmbedConfirmacao({
      valor,
      semanaId: semana.semanaId
    })],
    components: [criarBotoesNavegacao(token, true)],
    flags: 64
  });
}

async function confirmarFarm(interaction, token) {
  const sessao = sessoesFarm.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Reabra o painel.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode confirmar.",
      flags: 64
    });
  }

  aguardandoComprovante.set(interaction.user.id, {
    userId: interaction.user.id,
    channelId: sessao.channelId,
    valor: sessao.valor,
    semanaId: sessao.semanaId,
    criadoEm: Date.now()
  });

  sessoesFarm.delete(token);

  return interaction.update({
    content: `✅ Registro preparado para **R$ ${formatMoney(sessao.valor)}**.\nAgora envie a **foto do comprovante** neste canal.`,
    embeds: [],
    components: []
  });
}

async function cancelarFarm(interaction, token) {
  const sessao = sessoesFarm.get(token);

  if (sessao && sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode cancelar.",
      flags: 64
    });
  }

  sessoesFarm.delete(token);

  return interaction.update({
    content: "❌ Operação cancelada.",
    embeds: [],
    components: []
  });
}

async function processarBotaoFarm(interaction) {
  if (interaction.customId.startsWith(`${FARM_BUTTON_CANCELAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return cancelarFarm(interaction, token);
  }

  if (interaction.customId.startsWith(`${FARM_BUTTON_CONFIRMAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return confirmarFarm(interaction, token);
  }
}

async function processarMensagemComprovanteFarm(message) {
  if (!message.guild || message.author.bot) return;

  const pendencia = aguardandoComprovante.get(message.author.id);
  if (!pendencia) return;

  if (String(message.channelId) !== String(pendencia.channelId)) return;

  const possuiAnexo = message.attachments && message.attachments.size > 0;
  if (!possuiAnexo) return;

  const primeiroAnexo = message.attachments.first();
  const comprovante = primeiroAnexo?.url || "Sem comprovante";

  await FarmRegistro.create({
    userId: message.author.id,
    username: message.author.username,
    cargo: "membro",
    valor: pendencia.valor,
    comprovante,
    semanaId: pendencia.semanaId,
    registradoEm: new Date()
  });

  aguardandoComprovante.delete(message.author.id);

  try {
    await sincronizarPlanilhaFarm(message.guild);
  } catch (error) {
    console.error("Erro ao sincronizar planilha após registro de farm:", error);
  }

  await message.reply({
    content: `✅ Dinheiro sujo registrado com sucesso: **R$ ${formatMoney(pendencia.valor)}**`
  });
}

module.exports = {
  FARM_BUTTON_REGISTRAR,
  FARM_BUTTON_VOLTAR,
  FARM_BUTTON_CANCELAR,
  FARM_BUTTON_CONFIRMAR,
  FARM_MODAL_REGISTRAR,
  criarPainelFarm,
  abrirModalFarm,
  processarModalFarm,
  processarMensagemComprovanteFarm,
  processarBotaoFarm
};