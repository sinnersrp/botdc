const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const FarmRegistro = require("../models/FarmRegistro");
const { itensGerais, itensArmas } = require("../config/config");
const { isGerenteOuLider } = require("../utils/permissoes");
const getSemanaRP = require("../utils/semanaRP");
const logAjuste = require("../utils/logAjuste");

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

async function ajustarFarm(interaction, client) {
  const usuario = interaction.options.getUser("usuario", true);
  const acao = interaction.options.getString("acao", true);
  const valor = interaction.options.getInteger("valor", true);
  const motivo = interaction.options.getString("motivo", true);

  if (valor <= 0) {
    return interaction.reply({
      content: "❌ O valor precisa ser maior que zero.",
      flags: 64
    });
  }

  const semana = getSemanaRP();
  const valorFinal = acao === "remover" ? -Math.abs(valor) : Math.abs(valor);

  await FarmRegistro.create({
    userId: usuario.id,
    username: usuario.username,
    cargo: "membro",
    valor: valorFinal,
    comprovante: `AJUSTE MANUAL: ${motivo}`,
    semanaId: semana.semanaId,
    registradoEm: new Date()
  });

  const registros = await FarmRegistro.find({
    userId: usuario.id,
    semanaId: semana.semanaId
  });

  const totalSemana = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

  await logAjuste(client, {
    tipo: "Ajuste de farm",
    responsavel: interaction.user.tag,
    alvo: `${usuario.username} (${usuario.id})`,
    acao,
    valor: Math.abs(valor),
    motivo
  });

  return interaction.reply({
    content: [
      "✅ Ajuste de farm realizado.",
      `👤 Usuário: **${usuario.username}**`,
      `⚙️ Ação: **${acao}**`,
      `💰 Valor ajustado: **${formatMoney(Math.abs(valor))}**`,
      `📊 Total atual da semana: **${formatMoney(totalSemana)}**`
    ].join("\n"),
    flags: 64
  });
}

async function ajustarEstoque(interaction, client) {
  const estoqueTipo = interaction.options.getString("estoque", true);
  const acao = interaction.options.getString("acao", true);
  const item = interaction.options.getString("item", true);
  const quantidade = interaction.options.getInteger("quantidade", true);
  const motivo = interaction.options.getString("motivo", true);

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajuste-gerencia")
    .setDescription("Ajustes manuais da gerência")

    .addSubcommand(subcommand =>
      subcommand
        .setName("farm")
        .setDescription("Ajustar farm de um membro")
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
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerência pode usar este comando.",
        flags: 64
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "farm") {
      return ajustarFarm(interaction, client);
    }

    if (subcommand === "estoque") {
      return ajustarEstoque(interaction, client);
    }

    return interaction.reply({
      content: "❌ Subcomando inválido.",
      flags: 64
    });
  }
};