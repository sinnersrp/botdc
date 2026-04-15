const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");
const { canais } = require("../config/config");

const AVISO_BUTTON_AGORA = "aviso_agora";
const AVISO_BUTTON_AGENDAR = "aviso_agendar";

const AVISO_SELECT_MENCAO_PREFIX = "aviso_mencao";
const AVISO_SELECT_DIA_PREFIX = "aviso_dia";
const AVISO_SELECT_HORA_PREFIX = "aviso_hora";

const AVISO_MODAL_AGORA_PREFIX = "aviso_modal_agora";
const AVISO_MODAL_AGENDAR_PREFIX = "aviso_modal_agendar";

const agendamentosTemp = new Map();

function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getCanalAvisosId() {
  return (
    canais.canalAvisos ||
    canais.avisos ||
    canais.categoriaAvisos ||
    "1480507565770018851"
  );
}

async function buscarCanalAvisos(guild) {
  const canalId = String(getCanalAvisosId());

  let canal = guild.channels.cache.get(canalId);
  if (canal) return canal;

  try {
    canal = await guild.channels.fetch(canalId);
    if (canal) return canal;
  } catch (_) {}

  const nomesAceitos = [
    "avisos",
    "canal-de-avisos",
    "aviso",
    "avisos-gerais"
  ].map(normalizarTexto);

  canal =
    guild.channels.cache.find((ch) => nomesAceitos.includes(normalizarTexto(ch.name))) ||
    null;

  return canal;
}

function getTextoMencao(tipo) {
  if (tipo === "everyone") return "@everyone";
  if (tipo === "here") return "@here";
  if (tipo === "sem-mencao") return "";
  return "";
}

function criarPainelAvisos() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📢 Painel de Avisos")
    .setDescription(
      [
        "Use este painel para enviar avisos no canal oficial de avisos.",
        "",
        "**Opções:**",
        "• **Aviso agora** → envia imediatamente",
        "• **Agendar aviso** → programa para depois"
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Avisos" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(AVISO_BUTTON_AGORA)
      .setLabel("Aviso agora")
      .setEmoji("📣")
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

async function abrirModalAvisoAgora(interaction) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${AVISO_SELECT_MENCAO_PREFIX}:agora`)
    .setPlaceholder("Escolha como o aviso vai marcar as pessoas")
    .addOptions([
      {
        label: "Sem menção",
        value: "sem-mencao",
        description: "Envia o aviso sem marcar ninguém"
      },
      {
        label: "@everyone",
        value: "everyone",
        description: "Marca todo mundo"
      },
      {
        label: "@here",
        value: "here",
        description: "Marca apenas quem estiver online"
      }
    ]);

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "📢 Escolha como o aviso vai marcar as pessoas:",
    components: [row],
    flags: 64
  });
}

async function abrirModalAvisoAgendar(interaction) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${AVISO_SELECT_MENCAO_PREFIX}:agendar`)
    .setPlaceholder("Escolha como o aviso agendado vai marcar as pessoas")
    .addOptions([
      {
        label: "Sem menção",
        value: "sem-mencao",
        description: "Envia o aviso sem marcar ninguém"
      },
      {
        label: "@everyone",
        value: "everyone",
        description: "Marca todo mundo"
      },
      {
        label: "@here",
        value: "here",
        description: "Marca apenas quem estiver online"
      }
    ]);

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "⏰ Escolha como o aviso agendado vai marcar as pessoas:",
    components: [row],
    flags: 64
  });
}

async function processarSelectMencao(interaction) {
  const [, modo] = interaction.customId.split(":");
  const mencao = interaction.values[0];

  if (modo === "agora") {
    const modal = new ModalBuilder()
      .setCustomId(`${AVISO_MODAL_AGORA_PREFIX}:${mencao}`)
      .setTitle("Enviar aviso agora");

    const titulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título do aviso")
      .setPlaceholder("Ex: Aviso importante")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const mensagem = new TextInputBuilder()
      .setCustomId("mensagem")
      .setLabel("Mensagem")
      .setPlaceholder("Digite o aviso")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1800);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(mensagem)
    );

    return interaction.showModal(modal);
  }

  const token = `${interaction.user.id}_${Date.now()}`;
  agendamentosTemp.set(token, {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    mencao
  });

  const selectDia = new StringSelectMenuBuilder()
    .setCustomId(`${AVISO_SELECT_DIA_PREFIX}:${token}`)
    .setPlaceholder("Escolha o dia")
    .addOptions([
      { label: "Hoje", value: "hoje" },
      { label: "Amanhã", value: "amanha" }
    ]);

  const row = new ActionRowBuilder().addComponents(selectDia);

  return interaction.update({
    content: "📅 Escolha o dia do aviso:",
    embeds: [],
    components: [row]
  });
}

async function processarSelectDia(interaction) {
  const [, token] = interaction.customId.split(":");
  const sessao = agendamentosTemp.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta seleção expirou. Reabra o painel.",
      flags: 64
    });
  }

  sessao.dia = interaction.values[0];
  agendamentosTemp.set(token, sessao);

  const options = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    options.push({
      label: `${hh}:00`,
      value: `${hh}:00`
    });
  }

  const selectHora = new StringSelectMenuBuilder()
    .setCustomId(`${AVISO_SELECT_HORA_PREFIX}:${token}`)
    .setPlaceholder("Escolha a hora")
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectHora);

  return interaction.update({
    content: "🕒 Escolha a hora do aviso:",
    components: [row]
  });
}

async function processarSelectHora(interaction) {
  const [, token] = interaction.customId.split(":");
  const sessao = agendamentosTemp.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta seleção expirou. Reabra o painel.",
      flags: 64
    });
  }

  sessao.hora = interaction.values[0];
  agendamentosTemp.set(token, sessao);

  const modal = new ModalBuilder()
    .setCustomId(`${AVISO_MODAL_AGENDAR_PREFIX}:${token}`)
    .setTitle("Agendar aviso");

  const titulo = new TextInputBuilder()
    .setCustomId("titulo")
    .setLabel("Título do aviso")
    .setPlaceholder("Ex: Reunião da facção")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const mensagem = new TextInputBuilder()
    .setCustomId("mensagem")
    .setLabel("Mensagem")
    .setPlaceholder("Digite o aviso")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1800);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titulo),
    new ActionRowBuilder().addComponents(mensagem)
  );

  return interaction.showModal(modal);
}

async function enviarAvisoAgora(interaction) {
  const [, mencao] = interaction.customId.split(":");
  const guild = interaction.guild;

  const canalAvisos = await buscarCanalAvisos(guild);
  if (!canalAvisos) {
    return interaction.reply({
      content: `❌ Não encontrei o canal de avisos.\n📍 ID procurado: \`${getCanalAvisosId()}\``,
      flags: 64
    });
  }

  const titulo = interaction.fields.getTextInputValue("titulo");
  const mensagem = interaction.fields.getTextInputValue("mensagem");
  const prefixoMencao = getTextoMencao(mencao);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`📢 ${titulo}`)
    .setDescription(mensagem)
    .setFooter({ text: `SINNERS BOT • Avisos • por ${interaction.user.username}` })
    .setTimestamp();

  await canalAvisos.send({
    content: prefixoMencao || undefined,
    embeds: [embed]
  });

  return interaction.reply({
    content: `✅ Aviso enviado em ${canalAvisos}.`,
    flags: 64
  });
}

async function agendarAviso(interaction) {
  const [, token] = interaction.customId.split(":");
  const sessao = agendamentosTemp.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Este agendamento expirou. Reabra o painel.",
      flags: 64
    });
  }

  const canalAvisos = await buscarCanalAvisos(interaction.guild);
  if (!canalAvisos) {
    return interaction.reply({
      content: `❌ Não encontrei o canal de avisos.\n📍 ID procurado: \`${getCanalAvisosId()}\``,
      flags: 64
    });
  }

  const titulo = interaction.fields.getTextInputValue("titulo");
  const mensagem = interaction.fields.getTextInputValue("mensagem");

  const agora = new Date();
  const destino = new Date();

  if (sessao.dia === "amanha") {
    destino.setDate(destino.getDate() + 1);
  }

  const [hora, minuto] = String(sessao.hora || "00:00").split(":");
  destino.setHours(Number(hora), Number(minuto), 0, 0);

  if (destino.getTime() <= agora.getTime()) {
    return interaction.reply({
      content: "❌ O horário escolhido já passou.",
      flags: 64
    });
  }

  const delay = destino.getTime() - agora.getTime();
  const mencaoTexto = getTextoMencao(sessao.mencao);

  setTimeout(async () => {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`📢 ${titulo}`)
        .setDescription(mensagem)
        .setFooter({ text: "SINNERS BOT • Aviso agendado" })
        .setTimestamp();

      await canalAvisos.send({
        content: mencaoTexto || undefined,
        embeds: [embed]
      });
    } catch (error) {
      console.error("Erro ao enviar aviso agendado:", error);
    }
  }, delay);

  agendamentosTemp.delete(token);

  return interaction.reply({
    content: `✅ Aviso agendado para **${destino.toLocaleString("pt-BR")}** em ${canalAvisos}.`,
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
  criarPainelAvisos,
  abrirModalAvisoAgora,
  abrirModalAvisoAgendar,
  processarSelectMencao,
  processarSelectDia,
  processarSelectHora,
  enviarAvisoAgora,
  agendarAviso
};