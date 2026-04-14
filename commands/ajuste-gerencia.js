const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const ControleBau = require("../models/ControleBau");
const FarmRegistro = require("../models/FarmRegistro");
const { itensGerais, itensArmas } = require("../config/config");
const { podeUsarBauGerencia } = require("../utils/permissoes");
const getSemanaRP = require("../utils/semanaRP");
const logAjuste = require("../utils/logAjuste");
const { sincronizarPlanilhaFarm } = require("../utils/googleSheetsFarm");
const { sincronizarCaixaFaccao } = require("../utils/financeiroFaccao");

const opcoesItens = [
  { name: "📦 Maconha", value: "maconha" },
  { name: "📦 Metafetamina", value: "metafetamina" },
  { name: "📦 Cocaína", value: "cocaina" },
  { name: "📦 Attachs", value: "attachs" },
  { name: "📦 Colete", value: "colete" },
  { name: "📦 Algema", value: "algema" },
  { name: "📦 Envelope", value: "envelope" },
  { name: "📦 Lockpick", value: "lockpick" },
  { name: "📦 Chip Ilegal", value: "chip ilegal" },
  { name: "📦 Adrenalina", value: "adrenalina" },
  { name: "📦 Bandagem", value: "bandagem" },
  { name: "📦 Hacking", value: "hacking" },
  { name: "📦 Capuz", value: "capuz" },
  { name: "🔫 Muni PT", value: "muni pt" },
  { name: "🔫 Muni SUB", value: "muni sub" },
  { name: "🔫 Muni de Refle", value: "muni de refle" },
  { name: "🔫 SUB", value: "sub" },
  { name: "🔫 FiveSeven", value: "fiveseven" },
  { name: "🔫 HHK", value: "hhk" },
  { name: "🔫 MP5", value: "mp5" },
  { name: "🔫 G36", value: "g36" },
  { name: "🔫 C4", value: "c4" }
];

function getTipoItem(item) {
  if (itensArmas.includes(item)) return "arma";
  if (itensGerais.includes(item)) return "geral";
  return null;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function buildFarmConfirmCustomId({ userId, acao, valor, motivo, semanaId }) {
  const motivoSeguro = encodeURIComponent(motivo).slice(0, 70);
  return `ajusteFarm:${userId}:${acao}:${valor}:${semanaId}:${motivoSeguro}`;
}

function parseFarmConfirmCustomId(customId) {
  const [, userId, acao, valor, semanaId, motivoSeguro] = customId.split(":");
  return {
    userId,
    acao,
    valor: Number(valor),
    semanaId,
    motivo: decodeURIComponent(motivoSeguro || "")
  };
}

async function ajustarEstoque(interaction, client) {
  const estoqueTipo = interaction.options.getString("estoque", true);
  const acao = interaction.options.getString("acao", true);
  const item = interaction.options.getString("item", true);
  const quantidade = interaction.options.getInteger("quantidade", true);
  const motivo = interaction.options.getString("motivo", true);

  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este comando.",
      flags: 64
    });
  }

  if (quantidade < 0) {
    return interaction.reply({
      content: "❌ A quantidade não pode ser negativa.",
      flags: 64
    });
  }

  const tipo = getTipoItem(item);
  if (!tipo) {
    return interaction.reply({
      content: "❌ Item inválido.",
      flags: 64
    });
  }

  const itemDb = estoqueTipo === "gerencia" ? `gerencia_${item}` : item;

  let registro = await ControleBau.findOne({ item: itemDb });

  if (!registro) {
    registro = new ControleBau({
      item: itemDb,
      quantidade: 0,
      tipo
    });
  }

  if (acao === "adicionar") {
    registro.quantidade += quantidade;
  } else if (acao === "remover") {
    if (registro.quantidade < quantidade) {
      return interaction.reply({
        content: `❌ Estoque insuficiente. Atual: **${registro.quantidade}**`,
        flags: 64
      });
    }
    registro.quantidade -= quantidade;
  } else if (acao === "definir") {
    registro.quantidade = quantidade;
  }

  await registro.save();

  await logAjuste(client, {
    tipo: "Ajuste de estoque",
    responsavel: interaction.user.tag,
    alvo: "Estoque do sistema",
    acao,
    item,
    estoque: estoqueTipo === "gerencia" ? "Baú da Gerência" : "Controle de Baú",
    quantidade,
    motivo
  });

  return interaction.reply({
    content: [
      "✅ Ajuste de estoque realizado.",
      `🏷️ Estoque: **${estoqueTipo === "gerencia" ? "Baú da Gerência" : "Controle de Baú"}**`,
      `📦 Item: **${item}**`,
      `⚙️ Ação: **${acao}**`,
      `🔢 Quantidade aplicada: **${quantidade}**`,
      `📊 Estoque atual: **${registro.quantidade}**`
    ].join("\n"),
    flags: 64
  });
}

async function prepararAjusteFarm(interaction) {
  const usuario = interaction.options.getUser("usuario", true);
  const acao = interaction.options.getString("acao", true);
  const valor = interaction.options.getInteger("valor", true);
  const motivo = interaction.options.getString("motivo", true);

  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este comando.",
      flags: 64
    });
  }

  if (valor <= 0) {
    return interaction.reply({
      content: "❌ O valor precisa ser maior que zero.",
      flags: 64
    });
  }

  const semana = getSemanaRP();

  const registros = await FarmRegistro.find({
    userId: usuario.id,
    semanaId: semana.semanaId
  });

  const totalAtual = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  const totalDepois = acao === "remover"
    ? totalAtual - valor
    : totalAtual + valor;

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🛠️ Confirmar ajuste de dinheiro sujo")
    .addFields(
      {
        name: "👤 Membro",
        value: `${usuario}\n**${usuario.username}**`,
        inline: false
      },
      {
        name: "📊 Total atual",
        value: `**R$ ${formatMoney(totalAtual)}**`,
        inline: true
      },
      {
        name: "⚙️ Ação",
        value: `**${acao}**`,
        inline: true
      },
      {
        name: "💰 Valor do ajuste",
        value: `**R$ ${formatMoney(valor)}**`,
        inline: true
      },
      {
        name: "📈 Total após ajuste",
        value: `**R$ ${formatMoney(totalDepois)}**`,
        inline: true
      },
      {
        name: "📝 Motivo",
        value: `**${motivo}**`,
        inline: false
      }
    )
    .setFooter({
      text: "SINNERS BOT • Confirmação de ajuste"
    })
    .setTimestamp();

  const confirmId = buildFarmConfirmCustomId({
    userId: usuario.id,
    acao,
    valor,
    motivo,
    semanaId: semana.semanaId
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel("Confirmar ajuste")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ajusteFarmCancelar")
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    flags: 64
  });
}

async function confirmarAjusteFarm(interaction, client) {
  if (!podeUsarBauGerencia(interaction.member)) {
    if (!interaction.deferred && !interaction.replied) {
      return interaction.reply({
        content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este botão.",
        flags: 64
      });
    }
    return;
  }

  await interaction.deferUpdate();

  const dados = parseFarmConfirmCustomId(interaction.customId);

  const user = await client.users.fetch(dados.userId).catch(() => null);
  if (!user) {
    return interaction.editReply({
      content: "❌ Não foi possível encontrar o usuário desse ajuste.",
      embeds: [],
      components: []
    });
  }

  const valorFinal = dados.acao === "remover"
    ? -Math.abs(dados.valor)
    : Math.abs(dados.valor);

  await FarmRegistro.create({
    userId: user.id,
    username: user.username,
    cargo: "ajuste",
    valor: valorFinal,
    comprovante: `AJUSTE MANUAL: ${dados.motivo}`,
    semanaId: dados.semanaId,
    registradoEm: new Date()
  });

  const registros = await FarmRegistro.find({
    userId: user.id,
    semanaId: dados.semanaId
  });

  const totalSemana = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

  await logAjuste(client, {
    tipo: "Ajuste de dinheiro sujo",
    responsavel: interaction.user.tag,
    alvo: `${user.username} (${user.id})`,
    acao: dados.acao,
    valor: Math.abs(dados.valor),
    motivo: dados.motivo
  });

  await sincronizarCaixaFaccao().catch((error) => {
    console.error("Erro ao sincronizar caixa após ajuste:", error);
  });

  await sincronizarPlanilhaFarm(interaction.guild).catch((error) => {
    console.error("Erro ao sincronizar planilha após ajuste:", error);
  });

  return interaction.editReply({
    content: [
      "✅ Ajuste de dinheiro sujo confirmado.",
      `👤 Usuário: **${user.username}**`,
      `⚙️ Ação: **${dados.acao}**`,
      `💰 Valor ajustado: **R$ ${formatMoney(Math.abs(dados.valor))}**`,
      `📊 Total atual da semana: **R$ ${formatMoney(totalSemana)}**`
    ].join("\n"),
    embeds: [],
    components: []
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajuste-gerencia")
    .setDescription("Ajustes manuais da gerência")
    .addSubcommand(subcommand =>
      subcommand
        .setName("dinheiro-sujo")
        .setDescription("Ajustar dinheiro sujo de um membro")
        .addUserOption(option =>
          option.setName("usuario").setDescription("Membro que receberá o ajuste").setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("acao")
            .setDescription("Tipo de ajuste")
            .setRequired(true)
            .addChoices(
              { name: "Adicionar", value: "adicionar" },
              { name: "Remover", value: "remover" }
            )
        )
        .addIntegerOption(option =>
          option.setName("valor").setDescription("Valor do ajuste").setRequired(true).setMinValue(1)
        )
        .addStringOption(option =>
          option.setName("motivo").setDescription("Motivo do ajuste").setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("estoque")
        .setDescription("Ajustar estoque do sistema")
        .addStringOption(option =>
          option
            .setName("estoque")
            .setDescription("Qual estoque ajustar")
            .setRequired(true)
            .addChoices(
              { name: "Baú da Gerência", value: "gerencia" },
              { name: "Controle de Baú", value: "controle" }
            )
        )
        .addStringOption(option =>
          option
            .setName("acao")
            .setDescription("Tipo de ajuste")
            .setRequired(true)
            .addChoices(
              { name: "Adicionar", value: "adicionar" },
              { name: "Remover", value: "remover" },
              { name: "Definir", value: "definir" }
            )
        )
        .addStringOption(option =>
          option
            .setName("item")
            .setDescription("Item do estoque")
            .setRequired(true)
            .addChoices(...opcoesItens)
        )
        .addIntegerOption(option =>
          option.setName("quantidade").setDescription("Quantidade do ajuste").setRequired(true).setMinValue(0)
        )
        .addStringOption(option =>
          option.setName("motivo").setDescription("Motivo do ajuste").setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "dinheiro-sujo") {
      return prepararAjusteFarm(interaction);
    }

    if (subcommand === "estoque") {
      return ajustarEstoque(interaction, client);
    }

    return interaction.reply({
      content: "❌ Subcomando inválido.",
      flags: 64
    });
  },

  confirmarAjusteFarm
};