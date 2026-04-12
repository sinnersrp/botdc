const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const AvisoAgendado = require("../models/AvisoAgendado");
const { canais, cargoMembroPadrao } = require("../config/config");
const { isGerenteOuLider } = require("./permissoes");

const AVISO_BUTTON_AGORA = "aviso_enviar_agora";
const AVISO_BUTTON_AGENDAR = "aviso_agendar";

const AVISO_SELECT_MENCAO_PREFIX = "aviso_select_mencao";
const AVISO_SELECT_DIA_PREFIX = "aviso_select_dia";
const AVISO_SELECT_HORA_PREFIX = "aviso_select_hora";

const AVISO_MODAL_AGORA_PREFIX = "aviso_modal_agora";
const AVISO_MODAL_AGENDAR_PREFIX = "aviso_modal_agendar";

function isGerencia(interaction) {
  return isGerenteOuLider(interaction.member);
}

function normalizarAcao(acao = "") {
  return acao === "agendar" ? "agendar" : "agora";
}

function getMencaoLabel(tipo) {
  if (tipo === "everyone") return "@everyone";
  if (tipo === "membro") return "@membro";
  return "Sem menção";
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

function criarEmbedAviso({ mensagem, rodape = "SINNERS FAMILY • Aviso oficial" }) {
  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📢 Aviso da Família")
    .setDescription(mensagem)
    .setFooter({ text: rodape })
    .setTimestamp();
}

function criarPainelAvisos() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📢 Painel de Avisos")
    .setDescription(
      [
        "Use este painel para mandar avisos de forma rápida e organizada.",
        "",
        "**Opções:**",
        "• enviar aviso agora",
        "• agendar aviso",
        "",
        "**Fluxo simples:**",
        "1. escolher menção",
        "2. escolher dia e hora, se for agendado",
        "3. escrever só a mensagem"
      ].join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(AVISO_BUTTON_AGORA)
      .setLabel("Enviar agora")
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

function criarMenuMencao(acao) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${AVISO_SELECT_MENCAO_PREFIX}:${acao}`)
    .setPlaceholder("Escolha a menção do aviso")
    .addOptions(
      {
        label: "@everyone",
        value: "everyone",
        description: "Marca todo mundo"
      },
      {
        label: "@membro",
        value: "membro",
        description: "Marca o cargo de membro"
      },
      {
        label: "Sem menção",
        value: "nenhum",
        description: "Envia sem marcar ninguém"
      }
    );

  return {
    content: "📢 Escolha como o aviso vai marcar as pessoas:",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64
  };
}

function criarMenuDia(mencaoTipo) {
  const agora = new Date();
  const opcoes = [];

  for (let i = 0; i < 4; i++) {
    const data = new Date(agora);
    data.setDate(agora.getDate() + i);

    const texto = data.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit"
    });

    opcoes.push({
      label: i === 0 ? `Hoje - ${texto}` : i === 1 ? `Amanhã - ${texto}` : texto,
      value: String(i),
      description: `Agendar para ${texto}`
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${AVISO_SELECT_DIA_PREFIX}:${mencaoTipo}`)
    .setPlaceholder("Escolha o dia do aviso")
    .addOptions(opcoes);

  return {
    content: `📅 Menção escolhida: **${getMencaoLabel(mencaoTipo)}**\nAgora escolha o dia:`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64
  };
}

function criarMenuHora(mencaoTipo, diaOffset) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${AVISO_SELECT_HORA_PREFIX}:${mencaoTipo}:${diaOffset}`)
    .setPlaceholder("Escolha o horário do aviso")
    .addOptions(
      { label: "09:00", value: "09:00", description: "Enviar às 09:00" },
      { label: "12:00", value: "12:00", description: "Enviar às 12:00" },
      { label: "15:00", value: "15:00", description: "Enviar às 15:00" },
      { label: "18:00", value: "18:00", description: "Enviar às 18:00" },
      { label: "20:00", value: "20:00", description: "Enviar às 20:00" },
      { label: "21:00", value: "21:00", description: "Enviar às 21:00" },
      { label: "22:00", value: "22:00", description: "Enviar às 22:00" },
      { label: "23:00", value: "23:00", description: "Enviar às 23:00" }
    );

  return {
    content: `⏰ Menção escolhida: **${getMencaoLabel(mencaoTipo)}**\nAgora escolha o horário:`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64
  };
}

function criarModalAgora(mencaoTipo) {
  const modal = new ModalBuilder()
    .setCustomId(`${AVISO_MODAL_AGORA_PREFIX}:${mencaoTipo}`)
    .setTitle("Enviar aviso agora");

  const mensagem = new TextInputBuilder()
    .setCustomId("mensagem")
    .setLabel("Mensagem do aviso")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1800)
    .setPlaceholder("Escreva o aviso...");

  modal.addComponents(new ActionRowBuilder().addComponents(mensagem));
  return modal;
}

function criarModalAgendar(mencaoTipo, diaOffset, horaTexto) {
  const modal = new ModalBuilder()
    .setCustomId(`${AVISO_MODAL_AGENDAR_PREFIX}:${mencaoTipo}:${diaOffset}:${horaTexto}`)
    .setTitle("Agendar aviso");

  const mensagem = new TextInputBuilder()
    .setCustomId("mensagem")
    .setLabel("Mensagem do aviso")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1800)
    .setPlaceholder("Escreva o aviso...");

  modal.addComponents(new ActionRowBuilder().addComponents(mensagem));
  return modal;
}

function montarDataAgendada(diaOffset, horaTexto) {
  const [hora, minuto] = horaTexto.split(":").map(Number);
  const agora = new Date();
  const data = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate() + Number(diaOffset),
    hora,
    minuto,
    0,
    0
  );

  return data;
}

function formatarDataBr(data) {
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function abrirModalAvisoAgora(interaction) {
  if (!isGerencia(interaction)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  return interaction.reply(criarMenuMencao("agora"));
}

async function abrirModalAvisoAgendar(interaction) {
  if (!isGerencia(interaction)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  return interaction.reply(criarMenuMencao("agendar"));
}

async function processarSelectMencao(interaction) {
  if (!isGerencia(interaction)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  const [, acaoBruta] = interaction.customId.split(":");
  const acao = normalizarAcao(acaoBruta);
  const mencaoTipo = interaction.values[0];

  if (acao === "agora") {
    return interaction.showModal(criarModalAgora(mencaoTipo));
  }

  return interaction.update(criarMenuDia(mencaoTipo));
}

async function processarSelectDia(interaction) {
  if (!isGerencia(interaction)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  const [, mencaoTipo] = interaction.customId.split(":");
  const diaOffset = interaction.values[0];

  return interaction.update(criarMenuHora(mencaoTipo, diaOffset));
}

async function processarSelectHora(interaction) {
  if (!isGerencia(interaction)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  const [, mencaoTipo, diaOffset] = interaction.customId.split(":");
  const horaTexto = interaction.values[0];

  return interaction.showModal(criarModalAgendar(mencaoTipo, diaOffset, horaTexto));
}

async function enviarAvisoAgora(interaction) {
  if (!isGerencia(interaction)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  const [, mencaoTipo] = interaction.customId.split(":");
  const mensagem = interaction.fields.getTextInputValue("mensagem").trim();

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
        mensagem,
        rodape: `SINNERS FAMILY • Aviso enviado por ${interaction.user.username}`
      })
    ],
    allowedMentions: getAllowedMentions(mencaoTipo)
  });

  return interaction.reply({
    content: `✅ Aviso enviado com sucesso com menção **${getMencaoLabel(mencaoTipo)}**.`,
    flags: 64
  });
}

async function agendarAviso(interaction) {
  if (!isGerencia(interaction)) {
    return interaction.reply({
      content: "❌ Apenas a gerência pode usar este painel.",
      flags: 64
    });
  }

  const [, mencaoTipo, diaOffset, horaTexto] = interaction.customId.split(":");
  const mensagem = interaction.fields.getTextInputValue("mensagem").trim();

  const dataAgendada = montarDataAgendada(diaOffset, horaTexto);

  if (dataAgendada.getTime() <= Date.now()) {
    return interaction.reply({
      content: "❌ O horário escolhido já passou. Escolha outro.",
      flags: 64
    });
  }

  await AvisoAgendado.create({
    criadoPorId: interaction.user.id,
    criadoPorTag: interaction.user.tag,
    guildId: interaction.guild.id,
    canalId: canais.painelAvisos,
    titulo: "Aviso da Família",
    mensagem,
    mencaoTipo,
    agendarPara: dataAgendada,
    agendarTexto: formatarDataBr(dataAgendada)
  });

  return interaction.reply({
    content: [
      "✅ Aviso agendado com sucesso.",
      `🔔 Menção: **${getMencaoLabel(mencaoTipo)}**`,
      `⏰ Envio: **${formatarDataBr(dataAgendada)}**`
    ].join("\n"),
    flags: 64
  });
}

module.exports = {
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
  criarEmbedAviso,
  criarPainelAvisos,
  enviarAvisoAgora,
  agendarAviso,
  getAllowedMentions,
  getMencaoConteudo
};