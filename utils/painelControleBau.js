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
const { podeUsarControleBau } = require("./permissoes");
const { itensGerais, itensArmas } = require("../config/config");
const { isForumComandoBot, criarLinkCanal } = require("./redirecionamentoForum");
const { enviarLogBonito, criarCampo } = require("./logMovimentacaoBonita");

const CONTROLE_BUTTON_LIBERAR = "controle_bau_liberar";
const CONTROLE_BUTTON_RETIRAR = "controle_bau_retirar";
const CONTROLE_BUTTON_DEVOLVER = "controle_bau_devolver";
const CONTROLE_BUTTON_VER = "controle_bau_ver";

const CONTROLE_SELECT_LIBERAR = "controle_bau_select_liberar";
const CONTROLE_SELECT_RETIRAR = "controle_bau_select_retirar";
const CONTROLE_SELECT_DEVOLVER = "controle_bau_select_devolver";

const CONTROLE_MODAL_PREFIX = "controle_bau_modal";

const CANAL_CONTROLE_ENTRADA = "1480507568265760812";
const CANAL_CONTROLE_SAIDA = "1480507568265760814";

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
  return String(channelId) === CANAL_CONTROLE_ENTRADA;
}

function canalEhSaida(channelId) {
  return String(channelId) === CANAL_CONTROLE_SAIDA;
}

function validarCanalPorAcao(acao, channelId) {
  if (acao === "liberar") return canalEhEntrada(channelId);
  if (acao === "devolver") return canalEhEntrada(channelId);
  if (acao === "retirar") return canalEhSaida(channelId);
  if (acao === "ver") return canalEhEntrada(channelId) || canalEhSaida(channelId);
  return false;
}

function mensagemCanalInvalido(acao) {
  if (acao === "liberar") {
    return "❌ Use este painel no canal de **entrada** do controle de baú para liberar item aos membros.";
  }

  if (acao === "devolver") {
    return "❌ Use este painel no canal de **entrada** do controle de baú para devolver item ao baú liberado.";
  }

  if (acao === "retirar") {
    return "❌ Use este painel no canal de **saída** do controle de baú para registrar retirada dos membros.";
  }

  return "❌ Use este painel no canal correto do controle de baú.";
}

function responderRedirecionamentoForum(interaction, acao) {
  let canalId = "";
  let titulo = "";
  let descricao = "";

  if (acao === "liberar") {
    canalId = CANAL_CONTROLE_ENTRADA;
    titulo = "✅ Liberar item";
    descricao = "Use esta ação para colocar no controle de baú os itens que a liderança liberou aos membros.";
  }

  if (acao === "devolver") {
    canalId = CANAL_CONTROLE_ENTRADA;
    titulo = "📥 Devolver item";
    descricao = "Use esta ação quando algum item volta para o controle de baú.";
  }

  if (acao === "retirar") {
    canalId = CANAL_CONTROLE_SAIDA;
    titulo = "📤 Retirar item";
    descricao = "Use esta ação para registrar a retirada que os membros fizeram do controle de baú.";
  }

  if (acao === "ver") {
    canalId = CANAL_CONTROLE_ENTRADA;
    titulo = "📋 Ver estoque";
    descricao = "Você pode consultar o controle de baú pelo canal de entrada ou saída.";
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(titulo)
    .setDescription(
      [
        descricao,
        "",
        "Clique no botão abaixo para abrir o canal certo."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Redirecionamento" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Abrir canal correto")
      .setStyle(ButtonStyle.Link)
      .setURL(criarLinkCanal(interaction.guild.id, canalId))
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    flags: 64
  });
}

function criarPainelControleBau() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📦 Painel do Controle de Baú")
    .setDescription(
      [
        "Este é o **estoque liberado para os membros**.",
        "",
        "Aqui a liderança coloca aos poucos os itens que saíram do **baú da gerência** para uso da facção.",
        "",
        "**Fluxo certo:**",
        "1. item sai do **baú da gerência**",
        "2. item entra no **controle de baú**",
        "3. membro retira para usar",
        "4. se sobrar, devolve para o controle",
        "",
        "**Regras deste painel:**",
        "• **Liberar item** → canal **entrada**",
        "• **Devolver item** → canal **entrada**",
        "• **Retirar item** → canal **saída**",
        "• **Ver estoque** → funciona nos dois",
        "",
        "No **fórum**, os botões viram atalhos para abrir o canal certo."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Controle de Baú" })
    .setTimestamp();

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
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

async function abrirSelecaoLiberar(interaction) {
  if (!podeUsarControleBau(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para usar este painel.",
      flags: 64
    });
  }

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "liberar");
  }

  if (!validarCanalPorAcao("liberar", interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido("liberar"),
      flags: 64
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(CONTROLE_SELECT_LIBERAR)
    .setPlaceholder("Selecione o item para liberar")
    .addOptions(criarOpcoesItens());

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "Selecione o item que será liberado no controle de baú.",
    components: [row],
    flags: 64
  });
}

async function abrirSelecaoRetirar(interaction) {
  if (!podeUsarControleBau(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para usar este painel.",
      flags: 64
    });
  }

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "retirar");
  }

  if (!validarCanalPorAcao("retirar", interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido("retirar"),
      flags: 64
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(CONTROLE_SELECT_RETIRAR)
    .setPlaceholder("Selecione o item para retirar")
    .addOptions(criarOpcoesItens());

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "Selecione o item que será retirado do controle de baú.",
    components: [row],
    flags: 64
  });
}

async function abrirSelecaoDevolver(interaction) {
  if (!podeUsarControleBau(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para usar este painel.",
      flags: 64
    });
  }

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "devolver");
  }

  if (!validarCanalPorAcao("devolver", interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido("devolver"),
      flags: 64
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(CONTROLE_SELECT_DEVOLVER)
    .setPlaceholder("Selecione o item para devolver")
    .addOptions(criarOpcoesItens());

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "Selecione o item que será devolvido ao controle de baú.",
    components: [row],
    flags: 64
  });
}

async function processarSelecaoControleBau(interaction) {
  if (!podeUsarControleBau(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para esta ação.",
      flags: 64
    });
  }

  const item = interaction.values?.[0];
  let acao = "";

  if (interaction.customId === CONTROLE_SELECT_LIBERAR) acao = "liberar";
  if (interaction.customId === CONTROLE_SELECT_RETIRAR) acao = "retirar";
  if (interaction.customId === CONTROLE_SELECT_DEVOLVER) acao = "devolver";

  if (!validarCanalPorAcao(acao, interaction.channelId)) {
    return interaction.reply({
      content: mensagemCanalInvalido(acao),
      flags: 64
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`${CONTROLE_MODAL_PREFIX}:${acao}:${item}`)
    .setTitle(`Controle de Baú • ${acao}`);

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
    .setPlaceholder("Ex: ação da facção / devolução / retirada")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidade),
    new ActionRowBuilder().addComponents(observacao)
  );

  return interaction.showModal(modal);
}

async function processarModalControleBau(interaction) {
  if (!podeUsarControleBau(interaction.member)) {
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
  const tipoItem = getTipoItem(itemNormalizado);

  let registro = await ControleBau.findOne({ item: itemNormalizado });

  if (!registro) {
    registro = new ControleBau({
      item: itemNormalizado,
      quantidade: 0,
      tipo: tipoItem
    });
  }

  if (acao === "liberar" && registro.quantidade < quantidade) {
    return interaction.reply({
      content: `❌ Estoque insuficiente para liberar. Atual: **${formatarQuantidade(registro.quantidade)}**`,
      flags: 64
    });
  }

  if (acao === "retirar" && registro.quantidade < quantidade) {
    return interaction.reply({
      content: `❌ Estoque insuficiente para retirar. Atual: **${formatarQuantidade(registro.quantidade)}**`,
      flags: 64
    });
  }

  if (acao === "liberar") registro.quantidade -= quantidade;
  if (acao === "retirar") registro.quantidade -= quantidade;
  if (acao === "devolver") registro.quantidade += quantidade;

  await registro.save();

  await MovimentacaoBau.create({
    userId: interaction.user.id,
    username: interaction.user.username,
    item: itemNormalizado,
    quantidade,
    tipoMovimentacao: acao,
    observacao,
    canalId: interaction.channelId,
    canalNome: interaction.channel?.name || "canal-desconhecido",
    tipo: "controle_bau",
    acao: acao,
    cargo: "membro",
    registradoEm: new Date()
  });

  await enviarLogBonito(interaction.client, {
    color:
      acao === "devolver" ? 0x5865f2 :
      acao === "retirar" ? 0xed4245 :
      0x57f287,
    title:
      acao === "liberar" ? "✅ Item liberado no Controle de Baú" :
      acao === "retirar" ? "📤 Item retirado do Controle de Baú" :
      "📥 Item devolvido ao Controle de Baú",
    description: "Movimentação registrada no estoque liberado aos membros.",
    fields: [
      criarCampo("📦 Item", `**${formatarNomeBonito(itemNormalizado)}**`),
      criarCampo("🔢 Quantidade", `**${formatarQuantidade(quantidade)}**`),
      criarCampo("📊 Estoque atual", `**${formatarQuantidade(registro.quantidade)}**`),
      criarCampo("👤 Responsável", `**${interaction.user.username}**`),
      criarCampo("📝 Observação", observacao, false)
    ]
  });

  const embed = new EmbedBuilder()
    .setColor(
      acao === "devolver" ? 0x5865f2 :
      acao === "retirar" ? 0xed4245 :
      0x57f287
    )
    .setTitle("✅ Movimentação registrada")
    .addFields(
      {
        name: "📦 Item",
        value: `**${formatarNomeBonito(itemNormalizado)}**`,
        inline: true
      },
      {
        name: "⚙️ Ação",
        value: `**${acao}**`,
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
    .setFooter({ text: "SINNERS BOT • Controle de Baú" })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    flags: 64
  });
}

async function verEstoqueControleBau(interaction) {
  if (!podeUsarControleBau(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para ver este estoque.",
      flags: 64
    });
  }

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "ver");
  }

  if (!validarCanalPorAcao("ver", interaction.channelId)) {
    return interaction.reply({
      content: "❌ Use este painel nos canais de entrada ou saída do controle de baú.",
      flags: 64
    });
  }

  const itens = await ControleBau.find({
    item: { $not: /^gerencia_/i }
  }).sort({ item: 1 });

  if (!itens.length) {
    return interaction.reply({
      content: "📭 O controle de baú está vazio.",
      flags: 64
    });
  }

  const linhas = itens.map((registro) => {
    return `• **${formatarNomeBonito(registro.item)}** — ${formatarQuantidade(registro.quantidade)}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📋 Estoque do Controle de Baú")
    .setDescription(linhas.join("\n"))
    .setFooter({ text: "SINNERS BOT • Estoque liberado" })
    .setTimestamp();

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
  processarModalControleBau,
  processarSelecaoControleBau,
  verEstoqueControleBau,
  criarPainelControleBau
};