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
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const { podeUsarBauGerencia } = require("./permissoes");
const { itensGerais, itensArmas } = require("../config/config");

const BAU_BUTTON_ENTRADA = "bau_gerencia_entrada";
const BAU_BUTTON_SAIDA = "bau_gerencia_saida";
const BAU_BUTTON_VER = "bau_gerencia_ver";

const BAU_SELECT_ENTRADA = "bau_gerencia_select_entrada";
const BAU_SELECT_SAIDA = "bau_gerencia_select_saida";

const BAU_MODAL_PREFIX = "bau_gerencia_modal";

const CANAL_BAU_ENTRADA = "1486811209565995169";
const CANAL_BAU_SAIDA = "1486811278281408512";

function normalizarItem(item) {
  return String(item || "").trim().toLowerCase();
}

function formatarNomeBonito(item) {
  return String(item || "")
    .split(" ")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

function getTipoItem(item) {
  const nome = normalizarItem(item);
  if (itensArmas.map(normalizarItem).includes(nome)) return "arma";
  return "geral";
}

function getItemDb(item) {
  return `gerencia_${normalizarItem(item)}`;
}

function formatarQuantidade(valor) {
  return new Intl.NumberFormat("pt-BR").format(Number(valor) || 0);
}

function criarOpcoesItens() {
  const todos = [...itensGerais, ...itensArmas];

  return todos.slice(0, 25).map((item) => ({
    label: formatarNomeBonito(item),
    value: normalizarItem(item),
    description: getTipoItem(item) === "arma" ? "Arma / munição" : "Produto geral"
  }));
}

function canalEhEntrada(channelId) {
  return String(channelId) === CANAL_BAU_ENTRADA;
}

function canalEhSaida(channelId) {
  return String(channelId) === CANAL_BAU_SAIDA;
}

function validarCanalPorAcao(acao, channelId) {
  if (acao === "entrada") {
    return canalEhEntrada(channelId);
  }

  if (acao === "saida") {
    return canalEhSaida(channelId);
  }

  if (acao === "ver") {
    return canalEhEntrada(channelId) || canalEhSaida(channelId);
  }

  return false;
}

function mensagemCanalInvalido(acao) {
  if (acao === "entrada") {
    return "❌ Use este painel no canal de **entrada-bau** da gerência para adicionar item.";
  }

  if (acao === "saida") {
    return "❌ Use este painel no canal de **saida-bau** da gerência para retirar item.";
  }

  return "❌ Use este painel no canal correto do baú da gerência.";
}

function criarPainelBau() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📦 Painel do Baú da Gerência")
    .setDescription(
      [
        "Use os botões abaixo para gerenciar o baú da gerência.",
        "",
        "**Regras deste painel:**",
        "• **Entrada no baú** → canal **entrada-bau**",
        "• **Saída no baú** → canal **saida-bau**",
        "• **Ver estoque** → funciona nos dois"
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Baú da Gerência" })
    .setTimestamp();

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
      .setEmoji("📋")
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

async function abrirSelecaoEntradaBau(interaction) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este painel.",
      flags: 64
    });
  }

  if (!validarCanalPorAcao("entrada", interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido("entrada"),
      flags: 64
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(BAU_SELECT_ENTRADA)
    .setPlaceholder("Selecione o item para entrada")
    .addOptions(criarOpcoesItens());

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "Selecione o item que vai entrar no baú da gerência.",
    components: [row],
    flags: 64
  });
}

async function abrirSelecaoSaidaBau(interaction) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este painel.",
      flags: 64
    });
  }

  if (!validarCanalPorAcao("saida", interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido("saida"),
      flags: 64
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(BAU_SELECT_SAIDA)
    .setPlaceholder("Selecione o item para saída")
    .addOptions(criarOpcoesItens());

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "Selecione o item que vai sair do baú da gerência.",
    components: [row],
    flags: 64
  });
}

async function processarSelecaoBauGerencia(interaction) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para esta ação.",
      flags: 64
    });
  }

  const item = interaction.values?.[0];
  const acao = interaction.customId === BAU_SELECT_ENTRADA ? "entrada" : "saida";

  if (!validarCanalPorAcao(acao, interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido(acao),
      flags: 64
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`${BAU_MODAL_PREFIX}:${acao}:${item}`)
    .setTitle(`Baú da Gerência • ${acao === "entrada" ? "Entrada" : "Saída"}`);

  const quantidade = new TextInputBuilder()
    .setCustomId("quantidade")
    .setLabel("Quantidade")
    .setPlaceholder("Ex: 100")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const observacao = new TextInputBuilder()
    .setCustomId("observacao")
    .setLabel("Observação")
    .setPlaceholder("Ex: reposição da gerência")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidade),
    new ActionRowBuilder().addComponents(observacao)
  );

  return interaction.showModal(modal);
}

async function processarModalBauGerencia(interaction) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para esta ação.",
      flags: 64
    });
  }

  const [, acao, item] = interaction.customId.split(":");

  if (!validarCanalPorAcao(acao, interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido(acao),
      flags: 64
    });
  }

  const quantidade = Number(interaction.fields.getTextInputValue("quantidade"));
  const observacao = interaction.fields.getTextInputValue("observacao") || "Sem observação";

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    return interaction.reply({
      content: "❌ Quantidade inválida. Informe um número inteiro maior que zero.",
      flags: 64
    });
  }

  const itemNormalizado = normalizarItem(item);
  const itemDb = getItemDb(itemNormalizado);
  const tipo = getTipoItem(itemNormalizado);

  let registro = await ControleBau.findOne({ item: itemDb });

  if (!registro) {
    registro = new ControleBau({
      item: itemDb,
      quantidade: 0,
      tipo
    });
  }

  if (acao === "saida" && registro.quantidade < quantidade) {
    return interaction.reply({
      content: `❌ Estoque insuficiente. Atual: **${formatarQuantidade(registro.quantidade)}**`,
      flags: 64
    });
  }

  if (acao === "entrada") registro.quantidade += quantidade;
  if (acao === "saida") registro.quantidade -= quantidade;

  await registro.save();

  await MovimentacaoBau.create({
    userId: interaction.user.id,
    username: interaction.user.username,
    item: itemDb,
    itemOriginal: itemNormalizado,
    quantidade,
    tipoMovimentacao: acao,
    observacao,
    canalId: interaction.channelId,
    registradoEm: new Date()
  });

  const embed = new EmbedBuilder()
    .setColor(acao === "entrada" ? 0x57f287 : 0xed4245)
    .setTitle(`✅ ${acao === "entrada" ? "Entrada" : "Saída"} registrada`)
    .addFields(
      {
        name: "📦 Item",
        value: `**${formatarNomeBonito(itemNormalizado)}**`,
        inline: true
      },
      {
        name: "🔢 Quantidade",
        value: `**${formatarQuantidade(quantidade)}**`,
        inline: true
      },
      {
        name: "📊 Estoque atual",
        value: `**${formatarQuantidade(registro.quantidade)}**`,
        inline: true
      },
      {
        name: "📝 Observação",
        value: observacao,
        inline: false
      }
    )
    .setFooter({ text: "SINNERS BOT • Baú da Gerência" })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    flags: 64
  });
}

async function verEstoqueBauGerencia(interaction) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem ver este estoque.",
      flags: 64
    });
  }

  if (!validarCanalPorAcao("ver", interaction.channelId)) {
    return interaction.reply({
      content: "❌ Use este painel nos canais entrada-bau ou saida-bau.",
      flags: 64
    });
  }

  const itens = await ControleBau.find({
    item: { $regex: /^gerencia_/i }
  }).sort({ item: 1 });

  if (!itens.length) {
    return interaction.reply({
      content: "📭 O baú da gerência está vazio.",
      flags: 64
    });
  }

  const linhas = itens.map((registro) => {
    const itemOriginal = String(registro.item).replace(/^gerencia_/i, "");
    return `• **${formatarNomeBonito(itemOriginal)}** — ${formatarQuantidade(registro.quantidade)}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📋 Estoque do Baú da Gerência")
    .setDescription(linhas.join("\n"))
    .setFooter({ text: "SINNERS BOT • Estoque" })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    flags: 64
  });
}

module.exports = {
  BAU_BUTTON_ENTRADA,
  BAU_BUTTON_SAIDA,
  BAU_BUTTON_VER,
  BAU_SELECT_ENTRADA,
  BAU_SELECT_SAIDA,
  BAU_MODAL_PREFIX,
  abrirSelecaoEntradaBau,
  abrirSelecaoSaidaBau,
  processarModalBauGerencia,
  processarSelecaoBauGerencia,
  verEstoqueBauGerencia,
  criarPainelBau
};