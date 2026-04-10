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

const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const { canais, itensGerais, itensArmas } = require("../config/config");
const { isGerenteOuLider, isMembro } = require("./permissoes");
const logBau = require("./logBau");

const CONTROLE_BUTTON_LIBERAR = "controle_bau_liberar";
const CONTROLE_BUTTON_RETIRAR = "controle_bau_retirar";
const CONTROLE_BUTTON_DEVOLVER = "controle_bau_devolver";
const CONTROLE_BUTTON_VER = "controle_bau_ver";

const CONTROLE_SELECT_LIBERAR = "controle_select_liberar";
const CONTROLE_SELECT_RETIRAR = "controle_select_retirar";
const CONTROLE_SELECT_DEVOLVER = "controle_select_devolver";

const CONTROLE_MODAL_PREFIX = "controle_modal";

const ITENS_LABEL = {
  maconha: "📦 Maconha",
  metafetamina: "📦 Metafetamina",
  cocaina: "📦 Cocaína",
  attachs: "📦 Attachs",
  colete: "📦 Colete",
  algema: "📦 Algema",
  envelope: "📦 Envelope",
  lockpick: "📦 Lockpick",
  "chip ilegal": "📦 Chip Ilegal",
  adrenalina: "📦 Adrenalina",
  bandagem: "📦 Bandagem",
  hacking: "📦 Hacking",
  capuz: "📦 Capuz",
  "muni pt": "🔫 Muni PT",
  "muni sub": "🔫 Muni SUB",
  "muni de refle": "🔫 Muni de Refle",
  sub: "🔫 SUB",
  fiveseven: "🔫 FiveSeven",
  hhk: "🔫 HHK",
  c4: "🔫 C4",
  mp5: "🔫 MP5",
  g36: "🔫 G36"
};

function getTipoItem(item) {
  if (itensArmas.includes(item)) return "arma";
  if (itensGerais.includes(item)) return "geral";
  return null;
}

function formatarNomeItem(item) {
  return ITENS_LABEL[item] || item;
}

function encodeItem(item) {
  return item.replaceAll(" ", "~");
}

function decodeItem(item) {
  return item.replaceAll("~", " ");
}

function getSelectCustomIdByAction(action) {
  if (action === "liberar") return CONTROLE_SELECT_LIBERAR;
  if (action === "retirar") return CONTROLE_SELECT_RETIRAR;
  return CONTROLE_SELECT_DEVOLVER;
}

function getActionTitle(action) {
  if (action === "liberar") return "Liberar item";
  if (action === "retirar") return "Retirar item";
  return "Devolver item";
}

function getActionEmoji(action) {
  if (action === "liberar") return "✅";
  if (action === "retirar") return "📤";
  return "📥";
}

function criarPainelControleBau() {
  const embed = new EmbedBuilder()
    .setTitle("📦 Painel do Controle de Baú")
    .setDescription(
      [
        "Use os botões abaixo para movimentar o controle de baú.",
        "",
        "Os menus agora estão separados visualmente entre:",
        "🔫 **armas e munições**",
        "📦 **produtos gerais**"
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

function criarMenuSelecao(action) {
  const itensOrdenados = [...itensArmas, ...itensGerais];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(getSelectCustomIdByAction(action))
    .setPlaceholder("Selecione até 3 produtos")
    .setMinValues(1)
    .setMaxValues(3)
    .addOptions(
      itensOrdenados.map((item) => ({
        label: formatarNomeItem(item),
        value: item,
        description: `${getTipoItem(item) === "arma" ? "Arma / Munição" : "Produto Geral"}`
      }))
    );

  return {
    content: `${getActionEmoji(action)} **${getActionTitle(action)}**\nSelecione até 3 produtos abaixo.`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64
  };
}

function criarModalQuantidades(action, itens) {
  const modal = new ModalBuilder()
    .setCustomId(`${CONTROLE_MODAL_PREFIX}:${action}:${itens.map(encodeItem).join(",")}`)
    .setTitle(`${getActionTitle(action)} no controle de baú`);

  const rows = itens.map((item, index) => {
    const input = new TextInputBuilder()
      .setCustomId(`quantidade_${index + 1}`)
      .setLabel(`${formatarNomeItem(item)}`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Digite a quantidade")
      .setRequired(true)
      .setMaxLength(10);

    return new ActionRowBuilder().addComponents(input);
  });

  modal.addComponents(...rows);
  return modal;
}

function parseModalInfo(customId) {
  const [, action, rawItens] = customId.split(":");
  const itens = rawItens.split(",").map(decodeItem);
  return { action, itens };
}

function lerQuantidadesModal(interaction, itens) {
  return itens.map((item, index) => {
    const valor = interaction.fields.getTextInputValue(`quantidade_${index + 1}`).trim();
    const quantidade = Number(valor);

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new Error(`Quantidade inválida para ${formatarNomeItem(item)}.`);
    }

    return { item, quantidade };
  });
}

async function abrirSelecaoLiberar(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas gerência pode usar este painel.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({
      content: "❌ Use este painel no canal de entrada do controle de baú.",
      flags: 64
    });
  }

  return interaction.reply(criarMenuSelecao("liberar"));
}

async function abrirSelecaoRetirar(interaction) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para retirar itens.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.saida) {
    return interaction.reply({
      content: "❌ Use este painel no canal de saída do controle de baú.",
      flags: 64
    });
  }

  return interaction.reply(criarMenuSelecao("retirar"));
}

async function abrirSelecaoDevolver(interaction) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para devolver itens.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({
      content: "❌ Use este painel no canal de entrada do controle de baú.",
      flags: 64
    });
  }

  return interaction.reply(criarMenuSelecao("devolver"));
}

async function processarSelecaoControleBau(interaction) {
  let action = null;
  if (interaction.customId === CONTROLE_SELECT_LIBERAR) action = "liberar";
  if (interaction.customId === CONTROLE_SELECT_RETIRAR) action = "retirar";
  if (interaction.customId === CONTROLE_SELECT_DEVOLVER) action = "devolver";
  if (!action) return;

  const itens = interaction.values;

  if (!itens.length) {
    return interaction.reply({
      content: "❌ Nenhum item selecionado.",
      flags: 64
    });
  }

  await interaction.showModal(criarModalQuantidades(action, itens));
}

async function processarModalControleBau(interaction, client) {
  const { action, itens } = parseModalInfo(interaction.customId);
  const pares = lerQuantidadesModal(interaction, itens);

  if (action === "liberar") {
    return processarModalLiberar(interaction, client, pares);
  }

  if (action === "retirar") {
    return processarModalRetirar(interaction, client, pares);
  }

  if (action === "devolver") {
    return processarModalDevolver(interaction, client, pares);
  }
}

async function processarModalLiberar(interaction, client, pares) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas gerente ou líder pode liberar itens.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({
      content: "❌ Use este formulário no canal de entrada do controle de baú.",
      flags: 64
    });
  }

  const respostas = [];

  for (const par of pares) {
    const tipo = getTipoItem(par.item);
    if (!tipo) {
      return interaction.reply({
        content: `❌ O item **${par.item}** é inválido.`,
        flags: 64
      });
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

async function processarModalRetirar(interaction, client, pares) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para retirar itens.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.saida) {
    return interaction.reply({
      content: "❌ Use este formulário no canal de saída do controle de baú.",
      flags: 64
    });
  }

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

async function processarModalDevolver(interaction, client, pares) {
  if (!isMembro(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para devolver itens.",
      flags: 64
    });
  }

  if (interaction.channel.id !== canais.entrada) {
    return interaction.reply({
      content: "❌ Use este formulário no canal de entrada do controle de baú.",
      flags: 64
    });
  }

  const resposta = [];

  for (const par of pares) {
    const tipo = getTipoItem(par.item);

    if (!tipo) {
      return interaction.reply({
        content: `❌ O item **${par.item}** é inválido.`,
        flags: 64
      });
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

  const armas = [];
  const gerais = [];

  for (const item of itens) {
    const linha = `• ${formatarNomeItem(item.item)}: ${item.quantidade}`;
    if (item.tipo === "arma") armas.push(linha);
    else gerais.push(linha);
  }

  const embed = new EmbedBuilder()
    .setTitle("📦 Estoque do Controle de Baú")
    .addFields(
      {
        name: "🔫 Armas e munições",
        value: armas.length ? armas.join("\n") : "Nenhum item",
        inline: false
      },
      {
        name: "📦 Produtos gerais",
        value: gerais.length ? gerais.join("\n") : "Nenhum item",
        inline: false
      }
    );

  return interaction.reply({
    embeds: [embed],
    flags: 64
  });
}

module.exports = {
  CONTROLE_BUTTON_LIBERAR,
  CONTROLE_BUTTON_RETIRAR,
  CONTROLE_BUTTON_DEVOLVER,
  CONTROLE_BUTTON_VER,
  CONTROLE_SELECT_LIBERAR,
  CONTROLE_SELECT_RETIRAR,
  CONTROLE_SELECT_DEVOLVER,
  CONTROLE_MODAL_PREFIX,
  abrirSelecaoLiberar,
  abrirSelecaoRetirar,
  abrirSelecaoDevolver,
  criarPainelControleBau,
  processarModalControleBau,
  processarSelecaoControleBau,
  verEstoqueControleBau
};