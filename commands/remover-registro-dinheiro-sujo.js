const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const crypto = require("crypto");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const { sincronizarPlanilhaFarm } = require("../utils/googleSheetsFarm");
const { isGerenteOuLider } = require("../utils/permissoes");

const REMOVER_REGISTRO_SELECT_PREFIX = "remover_registro_select";
const REMOVER_REGISTRO_CONFIRM_PREFIX = "remover_registro_confirm";
const REMOVER_REGISTRO_CANCEL_PREFIX = "remover_registro_cancel";

const sessoesRemocao = new Map();

function gerarToken() {
  return crypto.randomBytes(8).toString("hex");
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleString("pt-BR");
}

function limparTexto(texto = "", max = 60) {
  const txt = String(texto || "").replace(/\s+/g, " ").trim();
  if (txt.length <= max) return txt;
  return `${txt.slice(0, max - 3)}...`;
}

function criarDescricaoRegistro(registro, index) {
  return [
    `**#${index + 1}**`,
    `💰 Valor: **R$ ${formatMoney(registro.valor)}**`,
    `📅 Data: **${formatDate(registro.registradoEm)}**`,
    `🧾 Comprovante/Obs: **${limparTexto(registro.comprovante || "Sem comprovante", 80)}**`,
    `🆔 ID: \`${registro._id}\``
  ].join("\n");
}

function criarEmbedLista(usuario, semanaId, registros, motivo) {
  const descricao = registros.length
    ? registros.map((registro, index) => criarDescricaoRegistro(registro, index)).join("\n\n")
    : "Nenhum registro encontrado.";

  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🗑️ Selecionar registro para remoção")
    .setDescription(
      [
        `👤 Membro: ${usuario}`,
        `🗓️ Semana: **${semanaId}**`,
        `📝 Motivo: **${motivo}**`,
        "",
        descricao
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Remoção de registro" })
    .setTimestamp();
}

function criarEmbedConfirmacao(usuario, semanaId, motivo, registro) {
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("⚠️ Confirmar remoção do registro")
    .setDescription(
      [
        `👤 Membro: ${usuario}`,
        `🗓️ Semana: **${semanaId}**`,
        `📝 Motivo: **${motivo}**`,
        "",
        `💰 Valor: **R$ ${formatMoney(registro.valor)}**`,
        `📅 Data: **${formatDate(registro.registradoEm)}**`,
        `🧾 Comprovante/Obs: **${limparTexto(registro.comprovante || "Sem comprovante", 120)}**`,
        `🆔 ID: \`${registro._id}\``
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Confirmação de remoção" })
    .setTimestamp();
}

function criarEmbedSucesso(usuario, semanaId, motivo, registroRemovido, totalRestante, quantidadeRestante) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Registro removido com sucesso")
    .setDescription(
      [
        `👤 Membro: ${usuario}`,
        `🗓️ Semana: **${semanaId}**`,
        `📝 Motivo: **${motivo}**`,
        "",
        `💰 Valor removido: **R$ ${formatMoney(registroRemovido.valor)}**`,
        `📅 Data removida: **${formatDate(registroRemovido.registradoEm)}**`,
        `📊 Registros restantes na semana: **${quantidadeRestante}**`,
        `💸 Total restante na semana: **R$ ${formatMoney(totalRestante)}**`
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Registro removido" })
    .setTimestamp();
}

function criarMenuSelecao(token, registros) {
  const options = registros.slice(0, 25).map((registro, index) => ({
    label: `#${index + 1} • R$ ${formatMoney(registro.valor)}`,
    description: `${formatDate(registro.registradoEm)} • ${limparTexto(registro.comprovante || "Sem comprovante", 50)}`,
    value: String(registro._id)
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${REMOVER_REGISTRO_SELECT_PREFIX}:${token}`)
      .setPlaceholder("Selecione o registro que deseja remover")
      .addOptions(options)
  );
}

function criarBotoesConfirmacao(token, registroId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${REMOVER_REGISTRO_CONFIRM_PREFIX}:${token}:${registroId}`)
      .setLabel("Confirmar remoção")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${REMOVER_REGISTRO_CANCEL_PREFIX}:${token}`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  REMOVER_REGISTRO_SELECT_PREFIX,
  REMOVER_REGISTRO_CONFIRM_PREFIX,
  REMOVER_REGISTRO_CANCEL_PREFIX,

  data: new SlashCommandBuilder()
    .setName("remover-registro-dinheiro-sujo")
    .setDescription("Remove um registro específico de dinheiro sujo por seleção")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Membro que terá um registro removido")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("motivo")
        .setDescription("Motivo da remoção")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("semana")
        .setDescription("Semana no formato 2026-04-11_2026-04-18. Se não preencher, usa a semana atual.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a liderança pode remover registros de dinheiro sujo.",
        flags: 64
      });
    }

    const usuario = interaction.options.getUser("usuario", true);
    const motivo = interaction.options.getString("motivo", true).trim();
    const semanaInformada = interaction.options.getString("semana");
    const semanaAtual = getSemanaRP();
    const semanaId = semanaInformada?.trim() || semanaAtual.semanaId;

    const registros = await FarmRegistro.find({
      userId: usuario.id,
      semanaId
    }).sort({ registradoEm: -1 });

    if (!registros.length) {
      return interaction.reply({
        content: `❌ Nenhum registro encontrado para **${usuario.username}** na semana **${semanaId}**.`,
        flags: 64
      });
    }

    const token = gerarToken();

    sessoesRemocao.set(token, {
      criadoPor: interaction.user.id,
      usuarioId: usuario.id,
      usuarioTag: usuario.username,
      semanaId,
      motivo,
      guildId: interaction.guildId,
      registros: registros.map((r) => ({
        _id: String(r._id),
        valor: Number(r.valor) || 0,
        comprovante: r.comprovante || "Sem comprovante",
        registradoEm: r.registradoEm
      })),
      criadoEm: Date.now()
    });

    return interaction.reply({
      embeds: [criarEmbedLista(usuario, semanaId, motivo, registros)],
      components: [criarMenuSelecao(token, registros)],
      flags: 64
    });
  },

  async handleSelectMenu(interaction) {
    const [, token] = interaction.customId.split(":");
    const sessao = sessoesRemocao.get(token);

    if (!sessao) {
      return interaction.reply({
        content: "❌ Esta seleção expirou. Rode o comando novamente.",
        flags: 64
      });
    }

    if (sessao.criadoPor !== interaction.user.id) {
      return interaction.reply({
        content: "❌ Apenas quem abriu essa seleção pode continuar.",
        flags: 64
      });
    }

    const registroId = interaction.values?.[0];
    const registro = sessao.registros.find((r) => String(r._id) === String(registroId));

    if (!registro) {
      return interaction.reply({
        content: "❌ Registro não encontrado nesta seleção.",
        flags: 64
      });
    }

    const usuarioTexto = `@${sessao.usuarioTag}`;

    return interaction.update({
      embeds: [
        criarEmbedConfirmacao(
          usuarioTexto,
          sessao.semanaId,
          sessao.motivo,
          registro
        )
      ],
      components: [criarBotoesConfirmacao(token, registroId)]
    });
  },

  async handleButton(interaction) {
    if (interaction.customId.startsWith(`${REMOVER_REGISTRO_CANCEL_PREFIX}:`)) {
      const [, token] = interaction.customId.split(":");
      const sessao = sessoesRemocao.get(token);

      if (sessao && sessao.criadoPor !== interaction.user.id) {
        return interaction.reply({
          content: "❌ Apenas quem abriu essa seleção pode cancelar.",
          flags: 64
        });
      }

      sessoesRemocao.delete(token);

      return interaction.update({
        content: "❌ Remoção cancelada.",
        embeds: [],
        components: []
      });
    }

    if (!interaction.customId.startsWith(`${REMOVER_REGISTRO_CONFIRM_PREFIX}:`)) {
      return;
    }

    const [, token, registroId] = interaction.customId.split(":");
    const sessao = sessoesRemocao.get(token);

    if (!sessao) {
      return interaction.reply({
        content: "❌ Esta confirmação expirou. Rode o comando novamente.",
        flags: 64
      });
    }

    if (sessao.criadoPor !== interaction.user.id) {
      return interaction.reply({
        content: "❌ Apenas quem abriu essa seleção pode confirmar.",
        flags: 64
      });
    }

    await interaction.deferUpdate();

    const registroBanco = await FarmRegistro.findById(registroId);
    if (!registroBanco) {
      sessoesRemocao.delete(token);

      return interaction.editReply({
        content: "❌ Esse registro já foi removido ou não existe mais.",
        embeds: [],
        components: []
      });
    }

    await FarmRegistro.deleteOne({ _id: registroId });

    const registrosRestantes = await FarmRegistro.find({
      userId: sessao.usuarioId,
      semanaId: sessao.semanaId
    });

    const totalRestante = registrosRestantes.reduce(
      (acc, item) => acc + (Number(item.valor) || 0),
      0
    );

    try {
      if (interaction.guild) {
        await sincronizarPlanilhaFarm(interaction.guild);
      }
    } catch (error) {
      console.error("Erro ao sincronizar planilha após remoção:", error);
    }

    sessoesRemocao.delete(token);

    return interaction.editReply({
      embeds: [
        criarEmbedSucesso(
          `@${sessao.usuarioTag}`,
          sessao.semanaId,
          sessao.motivo,
          registroBanco,
          totalRestante,
          registrosRestantes.length
        )
      ],
      components: []
    });
  }
};