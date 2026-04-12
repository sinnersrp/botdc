const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const AvisoAgendado = require("../models/AvisoAgendado");
const { canais, cargoMembroPadrao } = require("../config/config");
const { isGerenteOuLider } = require("./permissoes");

const AVISO_BUTTON_AGORA = "aviso_enviar_agora";
const AVISO_BUTTON_AGENDAR = "aviso_agendar";

const AVISO_MODAL_AGORA = "aviso_modal_agora";
const AVISO_MODAL_AGENDAR = "aviso_modal_agendar";

function parseBrazilDateTimeToUTC(input) {
  const match = String(input).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);

  if (!match) return null;

  const [, dd, mm, yyyy, hh, min] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const hour = Number(hh);
  const minute = Number(min);

  if (
    day < 1 || day > 31 ||
    month < 1 || month > 12 ||
    year < 2025 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
}

function normalizarMencao(input = "") {
  const valor = String(input).trim().toLowerCase();

  if (["everyone", "@everyone", "todos"].includes(valor)) return "everyone";
  if (["membro", "@membro", "membros"].includes(valor)) return "membro";
  if (["nenhum", "sem", "nao", "não"].includes(valor)) return "nenhum";

  return null;
}

function getMencaoConteudo(mencaoTipo) {
  if (mencaoTipo === "everyone") return "@everyone";
  if (mencaoTipo === "membro") return `<@&${cargoMembroPadrao}>`;
  return "";
}

function getAllowedMentions(mencaoTipo) {
  if (mencaoTipo === "everyone") {
    return { parse: ["everyone"] };
  }

  if (mencaoTipo === "membro") {
    return { roles: [cargoMembroPadrao] };
  }

  return { parse: [] };
}

function criarEmbedAviso({ titulo, mensagem, rodape = "SINNERS FAMILY • Aviso oficial" }) {
  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle(`📢 ${titulo}`)
    .setDescription(mensagem)
    .setFooter({
      text: rodape
    })
    .setTimestamp();
}

function criarPainelAvisos() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📢 Painel de Avisos da Família")
    .setDescription(
      [
        "Use este painel para criar avisos bonitos e organizados.",
        "",
        "**Funções disponíveis:**",
        "• Enviar aviso agora",
        "• Agendar aviso para outro horário",
        "",
        "**Menções aceitas:**",
        "• `everyone`",
        "• `membro`",
        "• `nenhum`",
        "",
        "**Formato do agendamento:**",
        "`DD/MM/AAAA HH:MM`",
        "Exemplo: `25/04/2026 21:30`"
      ].join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(AVISO_BUTTON_AGORA)
      .setLabel("Enviar aviso agora")
      .setEmoji("📨")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(AVISO_BUTTON_AGENDAR)
      .setLabel("Agendar aviso")
      .setEmoji("⏰")
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function criarModalAgora() {
  const modal = new ModalBuilder()
    .setCustomId(AVISO_MODAL_AGORA)
    .setTitle("Enviar aviso agora");

  const titulo = new TextInputBuilder()
    .setCustomId("titulo")
    .setLabel("Título do aviso")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80)
    .setPlaceholder("Ex: Reunião da família");

  const mensagem = new TextInputBuilder()
    .setCustomId("mensagem")
    .setLabel("Mensagem do aviso")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1800)
    .setPlaceholder("Escreva a mensagem bonita do aviso...");

  const mencao = new TextInputBuilder()
    .setCustomId("mencao")
    .setLabel("Menção (everyone / membro / nenhum)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20)
    .setPlaceholder("Ex: membro");

  modal.addComponents(
    new ActionRowBuilder().addComponents(titulo),
    new ActionRowBuilder().addComponents(mensagem),
    new ActionRowBuilder().addComponents(mencao)
  );

  return modal;
}

function criarModalAgendar() {
  const modal = new ModalBuilder()
    .setCustomId(AVISO_MODAL_AGENDAR)
    .setTitle("Agendar aviso");

  const titulo = new TextInputBuilder()
    .setCustomId("titulo")
    .setLabel("Título do aviso")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80)
    .setPlaceholder("Ex: Operação da família");

  const mensagem = new TextInputBuilder()
    .setCustomId("mensagem")
    .setLabel("Mensagem do aviso")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1800)
    .setPlaceholder("Escreva a mensagem bonita do aviso...");

  const mencao = new TextInputBuilder()
    .setCustomId("mencao")
    .setLabel("Menção (everyone / membro / nenhum)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20)
    .setPlaceholder("Ex: everyone");

  const dataHora = new TextInputBuilder()
    .setCustomId("datahora")
    .setLabel("Quando enviar (DD/MM/AAAA HH:MM)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20)
    .setPlaceholder("Ex: 25/04/2026 21:30");

  modal.addComponents(
    new ActionRowBuilder().addComponents(titulo),
    new ActionRowBuilder().addComponents(mensagem),
    new ActionRowBuilder().addComponents(mencao),
    new ActionRowBuilder().addComponents(dataHora)
  );

  return modal;
}

async function abrirModalAvisoAgora(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  await interaction.showModal(criarModalAgora());
}

async function abrirModalAvisoAgendar(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  await interaction.showModal(criarModalAgendar());
}

async function enviarAvisoAgora(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  const titulo = interaction.fields.getTextInputValue("titulo").trim();
  const mensagem = interaction.fields.getTextInputValue("mensagem").trim();
  const mencaoBruta = interaction.fields.getTextInputValue("mencao").trim();

  const mencaoTipo = normalizarMencao(mencaoBruta);
  if (!mencaoTipo) {
    return interaction.reply({
      content: "❌ Menção inválida. Use: `everyone`, `membro` ou `nenhum`.",
      flags: 64
    });
  }

  const canal = await interaction.client.channels.fetch(canais.painelAvisos).catch(() => null);
  if (!canal) {
    return interaction.reply({
      content: "❌ Não encontrei o canal de avisos.",
      flags: 64
    });
  }

  const conteudoMencao = getMencaoConteudo(mencaoTipo);

  await canal.send({
    content: conteudoMencao || undefined,
    embeds: [
      criarEmbedAviso({
        titulo,
        mensagem,
        rodape: `SINNERS FAMILY • Aviso enviado por ${interaction.user.username}`
      })
    ],
    allowedMentions: getAllowedMentions(mencaoTipo)
  });

  return interaction.reply({
    content: "✅ Aviso enviado com sucesso.",
    flags: 64
  });
}

async function agendarAviso(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  const titulo = interaction.fields.getTextInputValue("titulo").trim();
  const mensagem = interaction.fields.getTextInputValue("mensagem").trim();
  const mencaoBruta = interaction.fields.getTextInputValue("mencao").trim();
  const datahora = interaction.fields.getTextInputValue("datahora").trim();

  const mencaoTipo = normalizarMencao(mencaoBruta);
  if (!mencaoTipo) {
    return interaction.reply({
      content: "❌ Menção inválida. Use: `everyone`, `membro` ou `nenhum`.",
      flags: 64
    });
  }

  const data = parseBrazilDateTimeToUTC(datahora);
  if (!data || Number.isNaN(data.getTime())) {
    return interaction.reply({
      content: "❌ Data inválida. Use o formato `DD/MM/AAAA HH:MM`.",
      flags: 64
    });
  }

  if (data.getTime() <= Date.now()) {
    return interaction.reply({
      content: "❌ O horário do aviso precisa estar no futuro.",
      flags: 64
    });
  }

  await AvisoAgendado.create({
    criadoPorId: interaction.user.id,
    criadoPorTag: interaction.user.tag,
    guildId: interaction.guild.id,
    canalId: canais.painelAvisos,
    titulo,
    mensagem,
    mencaoTipo,
    agendarPara: data,
    agendarTexto: datahora
  });

  return interaction.reply({
    content: [
      "✅ Aviso agendado com sucesso.",
      `📢 Título: **${titulo}**`,
      `⏰ Envio: **${datahora}**`,
      `🔔 Menção: **${mencaoTipo}**`
    ].join("\n"),
    flags: 64
  });
}

module.exports = {
  AVISO_BUTTON_AGORA,
  AVISO_BUTTON_AGENDAR,
  AVISO_MODAL_AGORA,
  AVISO_MODAL_AGENDAR,
  abrirModalAvisoAgora,
  abrirModalAvisoAgendar,
  criarEmbedAviso,
  criarPainelAvisos,
  enviarAvisoAgora,
  agendarAviso,
  getAllowedMentions,
  getMencaoConteudo
};