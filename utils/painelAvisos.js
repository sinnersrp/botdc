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

const crypto = require("crypto");
const { canais } = require("../config/config");

const AVISO_BUTTON_AGORA = "aviso_agora";
const AVISO_BUTTON_AGENDAR = "aviso_agendar";

const AVISO_SELECT_MENCAO = "aviso_select_mencao";
const AVISO_SELECT_DIA = "aviso_select_dia";
const AVISO_SELECT_HORA = "aviso_select_hora";

const AVISO_BUTTON_VOLTAR = "aviso_voltar";
const AVISO_BUTTON_CANCELAR = "aviso_cancelar";
const AVISO_BUTTON_CONFIRMAR = "aviso_confirmar";

const AVISO_MODAL_CONTEUDO = "aviso_modal_conteudo";

const sessoesAvisos = new Map();

function gerarToken() {
  return crypto.randomBytes(8).toString("hex");
}

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
  return "";
}

function criarPainelAvisos() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📢 Painel de Avisos")
    .setDescription(
      [
        "Use este painel para enviar avisos no canal oficial.",
        "",
        "**Fluxos disponíveis:**",
        "• **Aviso agora**",
        "• **Agendar aviso**",
        "",
        "Agora com:",
        "• voltar",
        "• cancelar",
        "• confirmar"
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

function criarEmbedMencao(modo) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(modo === "agora" ? "📣 Aviso agora" : "⏰ Agendar aviso")
    .setDescription(
      [
        "**Etapa 1 de 4**",
        "Escolha o tipo de menção."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Avisos" })
    .setTimestamp();
}

function criarSelectMencao(token) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${AVISO_SELECT_MENCAO}:${token}`)
      .setPlaceholder("Escolha a menção")
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
          description: "Marca quem estiver online"
        }
      ])
  );
}

function criarEmbedDia() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("⏰ Agendar aviso")
    .setDescription(
      [
        "**Etapa 2 de 4**",
        "Escolha o dia do aviso."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Avisos" })
    .setTimestamp();
}

function criarSelectDia(token) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${AVISO_SELECT_DIA}:${token}`)
      .setPlaceholder("Escolha o dia")
      .addOptions([
        { label: "Hoje", value: "hoje" },
        { label: "Amanhã", value: "amanha" }
      ])
  );
}

function criarEmbedHora() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("⏰ Agendar aviso")
    .setDescription(
      [
        "**Etapa 3 de 4**",
        "Escolha a hora do aviso."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Avisos" })
    .setTimestamp();
}

function criarSelectHora(token) {
  const options = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    options.push({
      label: `${hh}:00`,
      value: `${hh}:00`
    });
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${AVISO_SELECT_HORA}:${token}`)
      .setPlaceholder("Escolha a hora")
      .addOptions(options)
  );
}

function criarBotoesNavegacao(token, etapa, podeConfirmar = false) {
  const row = new ActionRowBuilder();

  if (etapa !== "mencao") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${AVISO_BUTTON_VOLTAR}:${token}`)
        .setLabel("Voltar")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${AVISO_BUTTON_CANCELAR}:${token}`)
      .setLabel("Cancelar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary)
  );

  if (podeConfirmar) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${AVISO_BUTTON_CONFIRMAR}:${token}`)
        .setLabel("Confirmar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );
  }

  return row;
}

function criarEmbedConfirmacao(sessao) {
  const titulo = sessao.modo === "agora" ? "✅ Confirmar aviso agora" : "✅ Confirmar aviso agendado";

  const linhas = [
    `**Etapa final**`,
    `Modo: **${sessao.modo === "agora" ? "Aviso agora" : "Agendar aviso"}**`,
    `Menção: **${sessao.mencao}**`,
    `Título: **${sessao.titulo}**`,
    `Mensagem:`,
    `${sessao.mensagem}`
  ];

  if (sessao.modo === "agendar") {
    linhas.splice(2, 0, `Dia: **${sessao.dia}**`, `Hora: **${sessao.hora}**`);
  }

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(titulo)
    .setDescription(linhas.join("\n"))
    .setFooter({ text: "SINNERS BOT • Confirmação" })
    .setTimestamp();
}

async function abrirFluxoAviso(interaction, modo) {
  const token = gerarToken();

  sessoesAvisos.set(token, {
    token,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    modo,
    etapa: "mencao",
    mencao: null,
    dia: null,
    hora: null,
    titulo: null,
    mensagem: null
  });

  return interaction.reply({
    embeds: [criarEmbedMencao(modo)],
    components: [
      criarSelectMencao(token),
      criarBotoesNavegacao(token, "mencao")
    ],
    flags: 64
  });
}

async function abrirModalAvisoAgora(interaction) {
  return abrirFluxoAviso(interaction, "agora");
}

async function abrirModalAvisoAgendar(interaction) {
  return abrirFluxoAviso(interaction, "agendar");
}

async function processarSelectMencao(interaction) {
  const [, token] = interaction.customId.split(":");
  const sessao = sessoesAvisos.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Reabra o painel.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  sessao.mencao = interaction.values[0];
  sessoesAvisos.set(token, sessao);

  if (sessao.modo === "agora") {
    sessao.etapa = "conteudo";
    sessoesAvisos.set(token, sessao);

    const modal = new ModalBuilder()
      .setCustomId(`${AVISO_MODAL_CONTEUDO}:${token}`)
      .setTitle("Aviso agora");

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

  sessao.etapa = "dia";
  sessoesAvisos.set(token, sessao);

  return interaction.update({
    embeds: [criarEmbedDia()],
    components: [
      criarSelectDia(token),
      criarBotoesNavegacao(token, "dia")
    ]
  });
}

async function processarSelectDia(interaction) {
  const [, token] = interaction.customId.split(":");
  const sessao = sessoesAvisos.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Reabra o painel.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  sessao.dia = interaction.values[0];
  sessao.etapa = "hora";
  sessoesAvisos.set(token, sessao);

  return interaction.update({
    embeds: [criarEmbedHora()],
    components: [
      criarSelectHora(token),
      criarBotoesNavegacao(token, "hora")
    ]
  });
}

async function processarSelectHora(interaction) {
  const [, token] = interaction.customId.split(":");
  const sessao = sessoesAvisos.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Reabra o painel.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  sessao.hora = interaction.values[0];
  sessao.etapa = "conteudo";
  sessoesAvisos.set(token, sessao);

  const modal = new ModalBuilder()
    .setCustomId(`${AVISO_MODAL_CONTEUDO}:${token}`)
    .setTitle("Agendar aviso");

  const titulo = new TextInputBuilder()
    .setCustomId("titulo")
    .setLabel("Título do aviso")
    .setPlaceholder("Ex: Reunião")
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

async function processarModalConteudoAviso(interaction) {
  const [, token] = interaction.customId.split(":");
  const sessao = sessoesAvisos.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Reabra o painel.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  sessao.titulo = interaction.fields.getTextInputValue("titulo");
  sessao.mensagem = interaction.fields.getTextInputValue("mensagem");
  sessao.etapa = "confirmacao";
  sessoesAvisos.set(token, sessao);

  return interaction.reply({
    embeds: [criarEmbedConfirmacao(sessao)],
    components: [criarBotoesNavegacao(token, "confirmacao", true)],
    flags: 64
  });
}

async function voltarFluxoAviso(interaction, token) {
  const sessao = sessoesAvisos.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Reabra o painel.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  if (sessao.etapa === "dia") {
    sessao.etapa = "mencao";
    sessao.mencao = null;
    sessoesAvisos.set(token, sessao);

    return interaction.update({
      embeds: [criarEmbedMencao(sessao.modo)],
      components: [
        criarSelectMencao(token),
        criarBotoesNavegacao(token, "mencao")
      ]
    });
  }

  if (sessao.etapa === "hora") {
    sessao.etapa = "dia";
    sessao.dia = null;
    sessoesAvisos.set(token, sessao);

    return interaction.update({
      embeds: [criarEmbedDia()],
      components: [
        criarSelectDia(token),
        criarBotoesNavegacao(token, "dia")
      ]
    });
  }

  if (sessao.etapa === "confirmacao") {
    if (sessao.modo === "agendar") {
      sessao.etapa = "hora";
      sessao.titulo = null;
      sessao.mensagem = null;
      sessoesAvisos.set(token, sessao);

      return interaction.update({
        embeds: [criarEmbedHora()],
        components: [
          criarSelectHora(token),
          criarBotoesNavegacao(token, "hora")
        ]
      });
    }

    sessao.etapa = "mencao";
    sessao.titulo = null;
    sessao.mensagem = null;
    sessoesAvisos.set(token, sessao);

    return interaction.update({
      embeds: [criarEmbedMencao(sessao.modo)],
      components: [
        criarSelectMencao(token),
        criarBotoesNavegacao(token, "mencao")
      ]
    });
  }

  return interaction.reply({
    content: "❌ Não há etapa anterior disponível.",
    flags: 64
  });
}

async function cancelarFluxoAviso(interaction, token) {
  const sessao = sessoesAvisos.get(token);

  if (sessao && sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode cancelar.",
      flags: 64
    });
  }

  sessoesAvisos.delete(token);

  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    return interaction.update({
      content: "❌ Operação cancelada.",
      embeds: [],
      components: []
    });
  }

  return interaction.reply({
    content: "❌ Operação cancelada.",
    flags: 64
  });
}

async function confirmarFluxoAviso(interaction, token) {
  const sessao = sessoesAvisos.get(token);

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

  const canalAvisos = await buscarCanalAvisos(interaction.guild);
  if (!canalAvisos) {
    sessoesAvisos.delete(token);
    return interaction.update({
      content: `❌ Não encontrei o canal de avisos.\n📍 ID procurado: \`${getCanalAvisosId()}\``,
      embeds: [],
      components: []
    });
  }

  const prefixoMencao = getTextoMencao(sessao.mencao);

  if (sessao.modo === "agora") {
    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`📢 ${sessao.titulo}`)
      .setDescription(sessao.mensagem)
      .setFooter({ text: `SINNERS BOT • Avisos • por ${interaction.user.username}` })
      .setTimestamp();

    await canalAvisos.send({
      content: prefixoMencao || undefined,
      embeds: [embed]
    });

    sessoesAvisos.delete(token);

    return interaction.update({
      content: `✅ Aviso enviado em ${canalAvisos}.`,
      embeds: [],
      components: []
    });
  }

  const agora = new Date();
  const destino = new Date();

  if (sessao.dia === "amanha") {
    destino.setDate(destino.getDate() + 1);
  }

  const [hora, minuto] = String(sessao.hora || "00:00").split(":");
  destino.setHours(Number(hora), Number(minuto), 0, 0);

  if (destino.getTime() <= agora.getTime()) {
    sessoesAvisos.delete(token);
    return interaction.update({
      content: "❌ O horário escolhido já passou.",
      embeds: [],
      components: []
    });
  }

  const delay = destino.getTime() - agora.getTime();

  setTimeout(async () => {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`📢 ${sessao.titulo}`)
        .setDescription(sessao.mensagem)
        .setFooter({ text: "SINNERS BOT • Aviso agendado" })
        .setTimestamp();

      await canalAvisos.send({
        content: prefixoMencao || undefined,
        embeds: [embed]
      });
    } catch (error) {
      console.error("Erro ao enviar aviso agendado:", error);
    }
  }, delay);

  sessoesAvisos.delete(token);

  return interaction.update({
    content: `✅ Aviso agendado para **${destino.toLocaleString("pt-BR")}** em ${canalAvisos}.`,
    embeds: [],
    components: []
  });
}

async function processarBotaoAviso(interaction) {
  if (interaction.customId.startsWith(`${AVISO_BUTTON_VOLTAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return voltarFluxoAviso(interaction, token);
  }

  if (interaction.customId.startsWith(`${AVISO_BUTTON_CANCELAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return cancelarFluxoAviso(interaction, token);
  }

  if (interaction.customId.startsWith(`${AVISO_BUTTON_CONFIRMAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return confirmarFluxoAviso(interaction, token);
  }
}

module.exports = {
  AVISO_BUTTON_AGORA,
  AVISO_BUTTON_AGENDAR,
  AVISO_SELECT_MENCAO,
  AVISO_SELECT_DIA,
  AVISO_SELECT_HORA,
  AVISO_BUTTON_VOLTAR,
  AVISO_BUTTON_CANCELAR,
  AVISO_BUTTON_CONFIRMAR,
  AVISO_MODAL_CONTEUDO,
  criarPainelAvisos,
  abrirModalAvisoAgora,
  abrirModalAvisoAgendar,
  processarSelectMencao,
  processarSelectDia,
  processarSelectHora,
  processarModalConteudoAviso,
  processarBotaoAviso,
  buscarCanalAvisos
};