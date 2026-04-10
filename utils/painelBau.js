const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const ControleBau = require("../models/ControleBau");
const { canais, todosItens, itensGerais, itensArmas } = require("../config/config");
const { isGerenteOuLider } = require("./permissoes");

const BAU_BUTTON_ENTRADA = "bau_painel_entrada";
const BAU_BUTTON_SAIDA = "bau_painel_saida";
const BAU_BUTTON_VER = "bau_painel_ver";

const BAU_MODAL_ENTRADA = "bau_modal_entrada";
const BAU_MODAL_SAIDA = "bau_modal_saida";

const ITENS_LABEL = {
  maconha: "Maconha",
  metafetamina: "Metafetamina",
  cocaina: "Cocaína",
  "muni pt": "Muni PT",
  "muni sub": "Muni SUB",
  attachs: "Attachs",
  colete: "Colete",
  algema: "Algema",
  "dinheiro sujo": "Dinheiro Sujo",
  sub: "SUB",
  fiveseven: "FiveSeven",
  c4: "C4"
};

function getTipoItem(item) {
  if (itensArmas.includes(item)) return "arma";
  if (itensGerais.includes(item)) return "geral";
  return null;
}

function formatarNomeItem(item) {
  return ITENS_LABEL[item] || item;
}

function criarPainelBau() {
  const embed = new EmbedBuilder()
    .setTitle("📦 Painel do Baú da Gerência")
    .setDescription(
      [
        "Use os botões abaixo para gerenciar o baú da gerência.",
        "",
        "**Entrada/Saída:**",
        "Preencha até 3 linhas no formato:",
        "`item | quantidade`",
        "",
        "**Exemplo:**",
        "`maconha | 100`",
        "`cocaina | 50`",
        "`fiveseven | 10`"
      ].join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BAU_BUTTON_ENTRADA)
      .setLabel("Entrada no baú")
      .setEmoji("📥")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BAU_BUTTON_SAIDA)
      .setLabel("Saída no baú")
      .setEmoji("📤")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(BAU_BUTTON_VER)
      .setLabel("Ver estoque")
      .setEmoji("📦")
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function criarModalBauEntrada() {
  const modal = new ModalBuilder()
    .setCustomId(BAU_MODAL_ENTRADA)
    .setTitle("Entrada no baú da gerência");

  const linha1 = new TextInputBuilder()
    .setCustomId("linha1")
    .setLabel("Linha 1")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("maconha | 100")
    .setRequired(true);

  const linha2 = new TextInputBuilder()
    .setCustomId("linha2")
    .setLabel("Linha 2")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("cocaina | 50")
    .setRequired(false);

  const linha3 = new TextInputBuilder()
    .setCustomId("linha3")
    .setLabel("Linha 3")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("fiveseven | 10")
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(linha1),
    new ActionRowBuilder().addComponents(linha2),
    new ActionRowBuilder().addComponents(linha3)
  );

  return modal;
}

function criarModalBauSaida() {
  const modal = new ModalBuilder()
    .setCustomId(BAU_MODAL_SAIDA)
    .setTitle("Saída no baú da gerência");

  const linha1 = new TextInputBuilder()
    .setCustomId("linha1")
    .setLabel("Linha 1")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("maconha | 100")
    .setRequired(true);

  const linha2 = new TextInputBuilder()
    .setCustomId("linha2")
    .setLabel("Linha 2")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("cocaina | 50")
    .setRequired(false);

  const linha3 = new TextInputBuilder()
    .setCustomId("linha3")
    .setLabel("Linha 3")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("fiveseven | 10")
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(linha1),
    new ActionRowBuilder().addComponents(linha2),
    new ActionRowBuilder().addComponents(linha3)
  );

  return modal;
}

function parseLinha(linha) {
  if (!linha || !linha.trim()) return null;

  const partes = linha.split("|").map((p) => p.trim()).filter(Boolean);

  if (partes.length !== 2) {
    throw new Error(`Formato inválido em "${linha}". Use: item | quantidade`);
  }

  const item = partes[0].toLowerCase();
  const quantidade = Number(partes[1]);

  if (!todosItens.includes(item)) {
    throw new Error(`Item inválido: ${item}`);
  }

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error(`Quantidade inválida para ${item}`);
  }

  return { item, quantidade };
}

function obterLinhasModal(interaction) {
  const linhasRaw = [
    interaction.fields.getTextInputValue("linha1"),
    interaction.fields.getTextInputValue("linha2"),
    interaction.fields.getTextInputValue("linha3")
  ];

  const pares = linhasRaw
    .map((linha) => parseLinha(linha))
    .filter(Boolean);

  const itensUsados = new Set();

  for (const par of pares) {
    if (itensUsados.has(par.item)) {
      throw new Error(`O item "${par.item}" foi repetido no mesmo formulário.`);
    }
    itensUsados.add(par.item);
  }

  return pares;
}

async function abrirModalBauEntrada(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas gerência pode usar este painel.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.entradaBauGerencia) {
    return interaction.reply({
      content: "❌ Use o painel no canal de entrada do baú da gerência.",
      flags: 64
    });
  }

  await interaction.showModal(criarModalBauEntrada());
}

async function abrirModalBauSaida(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas gerência pode usar este painel.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.saidaBauGerencia) {
    return interaction.reply({
      content: "❌ Use o painel no canal de saída do baú da gerência.",
      flags: 64
    });
  }

  await interaction.showModal(criarModalBauSaida());
}

async function processarModalBauEntrada(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas gerência pode usar este painel.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.entradaBauGerencia) {
    return interaction.reply({
      content: "❌ Use este formulário no canal de entrada do baú da gerência.",
      flags: 64
    });
  }

  const pares = obterLinhasModal(interaction);
  const resposta = [];

  for (const par of pares) {
    const tipo = getTipoItem(par.item);
    let estoque = await ControleBau.findOne({ item: `gerencia_${par.item}` });

    if (!estoque) {
      estoque = new ControleBau({
        item: `gerencia_${par.item}`,
        quantidade: par.quantidade,
        tipo
      });
    } else {
      estoque.quantidade += par.quantidade;
    }

    await estoque.save();
    resposta.push(`• ${formatarNomeItem(par.item)}: ${par.quantidade}`);
  }

  return interaction.reply({
    content: `✅ Entrada registrada no baú da gerência:\n${resposta.join("\n")}`,
    flags: 64
  });
}

async function processarModalBauSaida(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas gerência pode usar este painel.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.saidaBauGerencia) {
    return interaction.reply({
      content: "❌ Use este formulário no canal de saída do baú da gerência.",
      flags: 64
    });
  }

  const pares = obterLinhasModal(interaction);

  for (const par of pares) {
    const estoque = await ControleBau.findOne({ item: `gerencia_${par.item}` });
    if (!estoque || estoque.quantidade < par.quantidade) {
      return interaction.reply({
        content: `❌ Estoque insuficiente para ${formatarNomeItem(par.item)}.`,
        flags: 64
      });
    }
  }

  const resposta = [];

  for (const par of pares) {
    const estoque = await ControleBau.findOne({ item: `gerencia_${par.item}` });
    estoque.quantidade -= par.quantidade;
    await estoque.save();
    resposta.push(`• ${formatarNomeItem(par.item)}: ${par.quantidade}`);
  }

  return interaction.reply({
    content: `📤 Saída registrada no baú da gerência:\n${resposta.join("\n")}`,
    flags: 64
  });
}

async function verEstoqueBauGerencia(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas gerência pode usar este painel.",
      flags: 64
    });
  }

  const itens = await ControleBau.find({
    item: { $regex: /^gerencia_/ }
  }).sort({ item: 1 });

  if (!itens.length) {
    return interaction.reply({
      content: "📦 O baú da gerência está vazio.",
      flags: 64
    });
  }

  const linhas = itens.map((item) => {
    const nomeLimpo = item.item.replace("gerencia_", "");
    return `• ${formatarNomeItem(nomeLimpo)}: ${item.quantidade}`;
  });

  return interaction.reply({
    content: `📦 **Estoque do baú da gerência**\n${linhas.join("\n")}`,
    flags: 64
  });
}

module.exports = {
  BAU_BUTTON_ENTRADA,
  BAU_BUTTON_SAIDA,
  BAU_BUTTON_VER,
  BAU_MODAL_ENTRADA,
  BAU_MODAL_SAIDA,
  abrirModalBauEntrada,
  abrirModalBauSaida,
  criarPainelBau,
  processarModalBauEntrada,
  processarModalBauSaida,
  verEstoqueBauGerencia
};