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
const { canais, itensGerais, itensArmas } = require("../config/config");
const { isGerenteOuLider } = require("./permissoes");

const BAU_BUTTON_ENTRADA = "bau_painel_entrada";
const BAU_BUTTON_SAIDA = "bau_painel_saida";
const BAU_BUTTON_VER = "bau_painel_ver";

const BAU_SELECT_ENTRADA = "bau_select_entrada";
const BAU_SELECT_SAIDA = "bau_select_saida";

const BAU_MODAL_PREFIX = "bau_modal";

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

function criarPainelBau() {
  const embed = new EmbedBuilder()
    .setTitle("📦 Painel do Baú da Gerência")
    .setDescription(
      [
        "Use os botões abaixo para gerenciar o baú da gerência.",
        "",
        "Os menus agora estão separados visualmente entre:",
        "🔫 **armas e munições**",
        "📦 **produtos gerais**"
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

function criarMenuSelecao(action) {
  const customId = action === "entrada" ? BAU_SELECT_ENTRADA : BAU_SELECT_SAIDA;
  const itensOrdenados = [...itensArmas, ...itensGerais];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Selecione até 3 produtos")
    .setMinValues(1)
    .setMaxValues(3)
    .addOptions(
      itensOrdenados.map((item) => ({
        label: formatarNomeItem(item),
        value: item,
        description: getTipoItem(item) === "arma" ? "Arma / Munição" : "Produto Geral"
      }))
    );

  return {
    content:
      action === "entrada"
        ? "📥 **Entrada no baú da gerência**\nSelecione até 3 produtos abaixo."
        : "📤 **Saída no baú da gerência**\nSelecione até 3 produtos abaixo.",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64
  };
}

function criarModalQuantidades(action, itens) {
  const modal = new ModalBuilder()
    .setCustomId(`${BAU_MODAL_PREFIX}:${action}:${itens.map(encodeItem).join(",")}`)
    .setTitle(action === "entrada" ? "Entrada no baú da gerência" : "Saída no baú da gerência");

  const rows = itens.map((item, index) => {
    const input = new TextInputBuilder()
      .setCustomId(`quantidade_${index + 1}`)
      .setLabel(formatarNomeItem(item))
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

async function abrirSelecaoEntradaBau(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({ content: "❌ Apenas gerência pode usar este painel.", flags: 64 });
  }

  if (interaction.channel.id !== canais.entradaBauGerencia) {
    return interaction.reply({ content: "❌ Use este painel no canal de entrada do baú da gerência.", flags: 64 });
  }

  return interaction.reply(criarMenuSelecao("entrada"));
}

async function abrirSelecaoSaidaBau(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({ content: "❌ Apenas gerência pode usar este painel.", flags: 64 });
  }

  if (interaction.channel.id !== canais.saidaBauGerencia) {
    return interaction.reply({ content: "❌ Use este painel no canal de saída do baú da gerência.", flags: 64 });
  }

  return interaction.reply(criarMenuSelecao("saida"));
}

async function processarSelecaoBauGerencia(interaction) {
  let action = null;
  if (interaction.customId === BAU_SELECT_ENTRADA) action = "entrada";
  if (interaction.customId === BAU_SELECT_SAIDA) action = "saida";
  if (!action) return;

  const itens = interaction.values;
  if (!itens.length) {
    return interaction.reply({ content: "❌ Nenhum item selecionado.", flags: 64 });
  }

  await interaction.showModal(criarModalQuantidades(action, itens));
}

async function processarModalBauGerencia(interaction) {
  const { action, itens } = parseModalInfo(interaction.customId);
  const pares = lerQuantidadesModal(interaction, itens);

  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({ content: "❌ Apenas gerência pode usar este painel.", flags: 64 });
  }

  if (action === "entrada") {
    if (interaction.channel.id !== canais.entradaBauGerencia) {
      return interaction.reply({ content: "❌ Use este formulário no canal de entrada do baú da gerência.", flags: 64 });
    }

    const resposta = [];

    for (const par of pares) {
      const tipo = getTipoItem(par.item);
      if (!tipo) {
        return interaction.reply({ content: `❌ O item **${par.item}** é inválido.`, flags: 64 });
      }

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

  if (action === "saida") {
    if (interaction.channel.id !== canais.saidaBauGerencia) {
      return interaction.reply({ content: "❌ Use este formulário no canal de saída do baú da gerência.", flags: 64 });
    }

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
}

async function verEstoqueBauGerencia(interaction) {
  if (!isGerenteOuLider(interaction.member)) {
    return interaction.reply({ content: "❌ Apenas gerência pode usar este painel.", flags: 64 });
  }

  const itens = await ControleBau.find({ item: { $regex: /^gerencia_/ } }).sort({ item: 1 });

  if (!itens.length) {
    return interaction.reply({ content: "📦 O baú da gerência está vazio.", flags: 64 });
  }

  const armas = [];
  const gerais = [];

  for (const item of itens) {
    const nomeLimpo = item.item.replace("gerencia_", "");
    const linha = `• ${formatarNomeItem(nomeLimpo)}: ${item.quantidade}`;

    if (item.tipo === "arma") armas.push(linha);
    else gerais.push(linha);
  }

  const embed = new EmbedBuilder()
    .setTitle("📦 Estoque do Baú da Gerência")
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
  enviarAvisoAgora,
  agendarAviso,
  criarPainelAvisos
};