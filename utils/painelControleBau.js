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
const MovimentacaoBau = require("../models/MovimentacaoBau");
const { canais, todosItens, itensGerais, itensArmas } = require("../config/config");
const { isGerenteOuLider, isMembro } = require("./permissoes");
const logBau = require("./logBau");

const CONTROLE_BUTTON_LIBERAR = "controle_bau_liberar";
const CONTROLE_BUTTON_RETIRAR = "controle_bau_retirar";
const CONTROLE_BUTTON_DEVOLVER = "controle_bau_devolver";
const CONTROLE_BUTTON_VER = "controle_bau_ver";

const CONTROLE_MODAL_LIBERAR = "controle_modal_liberar";
const CONTROLE_MODAL_RETIRAR = "controle_modal_retirar";
const CONTROLE_MODAL_DEVOLVER = "controle_modal_devolver";

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

function criarPainelControleBau() {
  const embed = new EmbedBuilder()
    .setTitle("📦 Painel do Controle de Baú")
    .setDescription(
      [
        "Use os botões abaixo para movimentar o controle de baú.",
        "",
        "**Formato do formulário:**",
        "`item | quantidade`",
        "",
        "**Exemplo:**",
        "`maconha | 100`",
        "`cocaina | 50`",
        "`fiveseven | 10`"
      ].join("\n")
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CONTROLE_BUTTON_LIBERAR)
      .setLabel("Liberar item")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CONTROLE_BUTTON_RETIRAR)
      .setLabel("Retirar item")
      .setEmoji("📤")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(CONTROLE_BUTTON_DEVOLVER)
      .setLabel("Devolver item")
      .setEmoji("📥")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CONTROLE_BUTTON_VER)
      .setLabel("Ver estoque")
      .setEmoji("📦")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

function criarModal(titulo, customId) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(titulo);

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

  const pares = linhasRaw.map(parseLinha).filter(Boolean);

  const itensUsados = new Set();
  for (const par of pares) {
    if (itensUsados.has(par.item)) {
      throw new Error(`O item "${par.item}" foi repetido no mesmo formulário.`);
    }
    itensUsados.add(par.item);
  }

  return pares;
}

async function abrirModalLiberar(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({ content: "❌ Apenas gerência pode usar este painel.", flags: 64 });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({ content: "❌ Use este painel no canal de entrada do controle de baú.", flags: 64 });
  }

  await interaction.showModal(criarModal("Liberar item no controle de baú", CONTROLE_MODAL_LIBERAR));
}

async function abrirModalRetirar(interaction) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({ content: "❌ Você não tem permissão para retirar itens.", flags: 64 });
  }

  if (interaction.channel.id !== canais.saida) {
    return interaction.reply({ content: "❌ Use este painel no canal de saída do controle de baú.", flags: 64 });
  }

  await interaction.showModal(criarModal("Retirar item do controle de baú", CONTROLE_MODAL_RETIRAR));
}

async function abrirModalDevolver(interaction) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({ content: "❌ Você não tem permissão para devolver itens.", flags: 64 });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({ content: "❌ Use este painel no canal de entrada do controle de baú.", flags: 64 });
  }

  await interaction.showModal(criarModal("Devolver item ao controle de baú", CONTROLE_MODAL_DEVOLVER));
}

async function processarModalLiberar(interaction, client) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({ content: "❌ Apenas gerente ou líder pode liberar itens.", flags: 64 });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({ content: "❌ Use este formulário no canal de entrada do controle de baú.", flags: 64 });
  }

  const pares = obterLinhasModal(interaction);
  const respostas = [];

  for (const par of pares) {
    const tipo = getTipoItem(par.item);
    if (!tipo) {
      return interaction.reply({ content: `❌ O item **${par.item}** é inválido.`, flags: 64 });
    }

    let registro = await ControleBau.findOne({ item: par.item });

    if (!registro) {
      registro = new ControleBau({
        item: par.item,
        quantidade: par.quantidade,
        tipo
      });
    } else {
      registro.quantidade += par.quantidade;
    }

    await registro.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.tag,
      cargo: "Gerência",
      acao: "liberou",
      item: par.item,
      quantidade: par.quantidade,
      tipo,
      canalId: interaction.channel.id,
      canalNome: interaction.channel.name
    });

    await logBau(client, {
      username: interaction.user.tag,
      cargo: "Gerência",
      acao: "Liberou",
      item: par.item,
      quantidade: par.quantidade,
      tipo,
      canalNome: interaction.channel.name
    });

    respostas.push(`• ${formatarNomeItem(par.item)}: ${par.quantidade}`);
  }

  return interaction.reply({
    content: `✅ Itens liberados no controle de baú:\n${respostas.join("\n")}`,
    flags: 64
  });
}

async function processarModalRetirar(interaction, client) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({ content: "❌ Você não tem permissão para retirar itens.", flags: 64 });
  }

  if (interaction.channel.id !== canais.saida) {
    return interaction.reply({ content: "❌ Use este formulário no canal de saída do controle de baú.", flags: 64 });
  }

  const pares = obterLinhasModal(interaction);

  for (const par of pares) {
    const estoque = await ControleBau.findOne({ item: par.item });

    if (!estoque || estoque.quantidade < par.quantidade) {
      return interaction.reply({
        content: `❌ Estoque insuficiente para ${formatarNomeItem(par.item)}.`,
        flags: 64
      });
    }
  }

  const resposta = [];

  for (const par of pares) {
    const estoque = await ControleBau.findOne({ item: par.item });
    estoque.quantidade -= par.quantidade;
    await estoque.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.tag,
      cargo: "Membro",
      acao: "retirou",
      item: par.item,
      quantidade: par.quantidade,
      tipo: estoque.tipo,
      canalId: interaction.channel.id,
      canalNome: interaction.channel.name
    });

    await logBau(client, {
      username: interaction.user.tag,
      cargo: "Membro",
      acao: "Retirou",
      item: par.item,
      quantidade: par.quantidade,
      tipo: estoque.tipo,
      canalNome: interaction.channel.name
    });

    resposta.push(`• ${formatarNomeItem(par.item)}: ${par.quantidade}`);
  }

  return interaction.reply({
    content: `📤 Itens retirados do controle de baú:\n${resposta.join("\n")}`,
    flags: 64
  });
}

async function processarModalDevolver(interaction, client) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({ content: "❌ Você não tem permissão para devolver itens.", flags: 64 });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({ content: "❌ Use este formulário no canal de entrada do controle de baú.", flags: 64 });
  }

  const pares = obterLinhasModal(interaction);
  const resposta = [];

  for (const par of pares) {
    const tipo = getTipoItem(par.item);
    if (!tipo) {
      return interaction.reply({ content: `❌ O item **${par.item}** é inválido.`, flags: 64 });
    }

    let estoque = await ControleBau.findOne({ item: par.item });

    if (!estoque) {
      estoque = new ControleBau({
        item: par.item,
        quantidade: par.quantidade,
        tipo
      });
    } else {
      estoque.quantidade += par.quantidade;
    }

    await estoque.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.tag,
      cargo: "Membro",
      acao: "devolveu",
      item: par.item,
      quantidade: par.quantidade,
      tipo,
      canalId: interaction.channel.id,
      canalNome: interaction.channel.name
    });

    await logBau(client, {
      username: interaction.user.tag,
      cargo: "Membro",
      acao: "Devolveu",
      item: par.item,
      quantidade: par.quantidade,
      tipo,
      canalNome: interaction.channel.name
    });

    resposta.push(`• ${formatarNomeItem(par.item)}: ${par.quantidade}`);
  }

  return interaction.reply({
    content: `📥 Itens devolvidos ao controle de baú:\n${resposta.join("\n")}`,
    flags: 64
  });
}

async function verEstoqueControleBau(interaction) {
  const itens = await ControleBau.find({
    item: { $not: /^gerencia_/ }
  }).sort({ item: 1 });

  if (!itens.length) {
    return interaction.reply({
      content: "📦 O controle de baú está vazio.",
      flags: 64
    });
  }

  const linhas = itens.map((item) => `• ${formatarNomeItem(item.item)}: ${item.quantidade}`);

  return interaction.reply({
    content: `📦 **Estoque do controle de baú**\n${linhas.join("\n")}`,
    flags: 64
  });
}

module.exports = {
  CONTROLE_BUTTON_LIBERAR,
  CONTROLE_BUTTON_RETIRAR,
  CONTROLE_BUTTON_DEVOLVER,
  CONTROLE_BUTTON_VER,
  CONTROLE_MODAL_LIBERAR,
  CONTROLE_MODAL_RETIRAR,
  CONTROLE_MODAL_DEVOLVER,
  abrirModalLiberar,
  abrirModalRetirar,
  abrirModalDevolver,
  criarPainelControleBau,
  processarModalLiberar,
  processarModalRetirar,
  processarModalDevolver,
  verEstoqueControleBau
};