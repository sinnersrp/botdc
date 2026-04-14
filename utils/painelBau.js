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
const { isForumComandoBot, criarLinkCanal } = require("./redirecionamentoForum");
const { enviarLogBonito, criarCampo } = require("./logMovimentacaoBonita");

const BAU_BUTTON_ENTRADA = "bau_gerencia_entrada";
const BAU_BUTTON_SAIDA = "bau_gerencia_saida";
const BAU_BUTTON_TRANSFERIR = "bau_gerencia_transferir";
const BAU_BUTTON_VER = "bau_gerencia_ver";

const BAU_SELECT_ENTRADA = "bau_gerencia_select_entrada";
const BAU_SELECT_SAIDA = "bau_gerencia_select_saida";
const BAU_SELECT_TRANSFERIR = "bau_gerencia_select_transferir";

const BAU_MODAL_PREFIX = "bau_gerencia_modal";

// IDs que você passou
const CANAL_BAU_ENTRADA = "1486811209565995169";
const CANAL_BAU_SAIDA = "1486811278281408512";

function normalizarTexto(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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

function canalEhEntrada(channel) {
  if (!channel) return false;
  const id = String(channel.id);
  const nome = normalizarTexto(channel.name);

  return id === CANAL_BAU_ENTRADA || nome === "entrada-bau";
}

function canalEhSaida(channel) {
  if (!channel) return false;
  const id = String(channel.id);
  const nome = normalizarTexto(channel.name);

  return id === CANAL_BAU_SAIDA || nome === "saida-bau";
}

function validarCanalPorAcao(acao, channel) {
  if (acao === "entrada") return canalEhEntrada(channel);
  if (acao === "saida") return canalEhSaida(channel);
  if (acao === "transferir") return canalEhSaida(channel);
  if (acao === "ver") return canalEhEntrada(channel) || canalEhSaida(channel);
  return false;
}

function mensagemCanalInvalido(acao, channel) {
  const atual = channel?.name ? `\n📍 Canal atual: **#${channel.name}**` : "";

  if (acao === "entrada") {
    return `❌ Use este painel no canal de **entrada-bau** da gerência para registrar produtos recebidos dos fornecedores.${atual}`;
  }

  if (acao === "saida") {
    return `❌ Use este painel no canal de **saida-bau** da gerência para retirar itens do estoque principal.${atual}`;
  }

  if (acao === "transferir") {
    return `❌ Use este painel no canal de **saida-bau** da gerência para transferir itens para o controle de baú.${atual}`;
  }

  return `❌ Use este painel no canal correto do baú da gerência.${atual}`;
}

function responderRedirecionamentoForum(interaction, acao) {
  let canalId = "";
  let titulo = "";
  let descricao = "";

  if (acao === "entrada") {
    canalId = CANAL_BAU_ENTRADA;
    titulo = "📥 Entrada no baú da gerência";
    descricao = "Use esta ação para registrar tudo que a liderança recebeu dos fornecedores no estoque principal.";
  }

  if (acao === "saida") {
    canalId = CANAL_BAU_SAIDA;
    titulo = "📤 Saída no baú da gerência";
    descricao = "Use esta ação para retirar itens do estoque principal.";
  }

  if (acao === "transferir") {
    canalId = CANAL_BAU_SAIDA;
    titulo = "🔄 Transferir para controle";
    descricao = "Use esta ação para tirar do baú da gerência e colocar direto no controle de baú.";
  }

  if (acao === "ver") {
    canalId = CANAL_BAU_ENTRADA;
    titulo = "📋 Ver estoque do baú da gerência";
    descricao = "Você pode consultar o estoque principal pelo canal de entrada-bau ou saida-bau.";
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

function criarPainelBau() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📦 Painel do Baú da Gerência")
    .setDescription(
      [
        "Este é o **estoque principal da facção**.",
        "",
        "Aqui a liderança registra tudo que recebe dos **fornecedores** antes de liberar aos membros.",
        "",
        "**Fluxo certo:**",
        "1. fornecedor entrega",
        "2. entra no **baú da gerência**",
        "3. depois uma parte sai daqui para o **controle de baú**",
        "",
        "**Regras deste painel:**",
        "• **Entrada no baú** → canal **entrada-bau**",
        "• **Saída no baú** → canal **saida-bau**",
        "• **Transferir p/ Controle** → canal **saida-bau**",
        "• **Ver estoque** → funciona nos dois",
        "",
        "No **fórum**, os botões viram atalhos para abrir o canal certo."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Baú da Gerência" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
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
      .setCustomId(BAU_BUTTON_TRANSFERIR)
      .setLabel("Transferir p/ Controle")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BAU_BUTTON_VER)
      .setLabel("Ver estoque")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

async function abrirSelecaoEntradaBau(interaction) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este painel.",
      flags: 64
    });
  }

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "entrada");
  }

  if (!validarCanalPorAcao("entrada", interaction.channel)) {
    return interaction.reply({
      content: mensagemCanalInvalido("entrada", interaction.channel),
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

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "saida");
  }

  if (!validarCanalPorAcao("saida", interaction.channel)) {
    return interaction.reply({
      content: mensagemCanalInvalido("saida", interaction.channel),
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

async function abrirSelecaoTransferirBau(interaction) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este painel.",
      flags: 64
    });
  }

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "transferir");
  }

  if (!validarCanalPorAcao("transferir", interaction.channel)) {
    return interaction.reply({
      content: mensagemCanalInvalido("transferir", interaction.channel),
      flags: 64
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(BAU_SELECT_TRANSFERIR)
    .setPlaceholder("Selecione o item para transferir")
    .addOptions(criarOpcoesItens());

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({
    content: "Selecione o item que será transferido para o controle de baú.",
    components: [row],
    flags: 64
  });
}

async function processarSelecaoBauGerencia(interaction, client) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para esta ação.",
      flags: 64
    });
  }

  const item = interaction.values?.[0];
  let acao = "";

  if (interaction.customId === BAU_SELECT_ENTRADA) acao = "entrada";
  if (interaction.customId === BAU_SELECT_SAIDA) acao = "saida";
  if (interaction.customId === BAU_SELECT_TRANSFERIR) acao = "transferir";

  if (!validarCanalPorAcao(acao, interaction.channel)) {
    return interaction.reply({
      content: mensagemCanalInvalido(acao, interaction.channel),
      flags: 64
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`${BAU_MODAL_PREFIX}:${acao}:${item}`)
    .setTitle(`Baú da Gerência • ${acao}`);

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
    .setPlaceholder("Ex: fornecedor entregou / liberação para o controle")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidade),
    new ActionRowBuilder().addComponents(observacao)
  );

  return interaction.showModal(modal);
}

async function processarModalBauGerencia(interaction, client) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para esta ação.",
      flags: 64
    });
  }

  const [, acao, item] = interaction.customId.split(":");

  if (!validarCanalPorAcao(acao, interaction.channel)) {
    return interaction.reply({
      content: mensagemCanalInvalido(acao, interaction.channel),
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
  const tipoItem = getTipoItem(itemNormalizado);

  let registroGerencia = await ControleBau.findOne({ item: itemDb });

  if (!registroGerencia) {
    registroGerencia = new ControleBau({
      item: itemDb,
      quantidade: 0,
      tipo: tipoItem
    });
  }

  if ((acao === "saida" || acao === "transferir") && registroGerencia.quantidade < quantidade) {
    return interaction.reply({
      content: `❌ Estoque insuficiente. Atual: **${formatarQuantidade(registroGerencia.quantidade)}**`,
      flags: 64
    });
  }

  if (acao === "entrada") {
    registroGerencia.quantidade += quantidade;
    await registroGerencia.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.username,
      item: itemDb,
      itemOriginal: itemNormalizado,
      quantidade,
      tipoMovimentacao: "entrada",
      observacao,
      canalId: interaction.channelId,
      canalNome: interaction.channel?.name || "canal-desconhecido",
      tipo: "bau_gerencia",
      acao: "entrada",
      cargo: "gerencia",
      registradoEm: new Date()
    });

    await enviarLogBonito(client, {
      color: 0x57f287,
      title: "📥 Entrada no Baú da Gerência",
      description: "Produto recebido dos fornecedores e registrado no estoque principal.",
      fields: [
        criarCampo("📦 Item", `**${formatarNomeBonito(itemNormalizado)}**`),
        criarCampo("🔢 Quantidade", `**${formatarQuantidade(quantidade)}**`),
        criarCampo("📊 Estoque atual", `**${formatarQuantidade(registroGerencia.quantidade)}**`),
        criarCampo("👤 Responsável", `**${interaction.user.username}**`),
        criarCampo("📝 Observação", observacao, false)
      ]
    });
  }

  if (acao === "saida") {
    registroGerencia.quantidade -= quantidade;
    await registroGerencia.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.username,
      item: itemDb,
      itemOriginal: itemNormalizado,
      quantidade,
      tipoMovimentacao: "saida",
      observacao,
      canalId: interaction.channelId,
      canalNome: interaction.channel?.name || "canal-desconhecido",
      tipo: "bau_gerencia",
      acao: "saida",
      cargo: "gerencia",
      registradoEm: new Date()
    });

    await enviarLogBonito(client, {
      color: 0xed4245,
      title: "📤 Saída no Baú da Gerência",
      description: "Item retirado do estoque principal.",
      fields: [
        criarCampo("📦 Item", `**${formatarNomeBonito(itemNormalizado)}**`),
        criarCampo("🔢 Quantidade", `**${formatarQuantidade(quantidade)}**`),
        criarCampo("📊 Estoque atual", `**${formatarQuantidade(registroGerencia.quantidade)}**`),
        criarCampo("👤 Responsável", `**${interaction.user.username}**`),
        criarCampo("📝 Observação", observacao, false)
      ]
    });
  }

  if (acao === "transferir") {
    registroGerencia.quantidade -= quantidade;
    await registroGerencia.save();

    let registroControle = await ControleBau.findOne({ item: itemNormalizado });

    if (!registroControle) {
      registroControle = new ControleBau({
        item: itemNormalizado,
        quantidade: 0,
        tipo: tipoItem
      });
    }

    registroControle.quantidade += quantidade;
    await registroControle.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.username,
      item: itemDb,
      itemOriginal: itemNormalizado,
      quantidade,
      tipoMovimentacao: "transferencia_controle",
      observacao,
      canalId: interaction.channelId,
      canalNome: interaction.channel?.name || "canal-desconhecido",
      tipo: "bau_gerencia",
      acao: "transferir",
      cargo: "gerencia",
      registradoEm: new Date()
    });

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.username,
      item: itemNormalizado,
      quantidade,
      tipoMovimentacao: "liberar",
      observacao: `TRANSFERIDO DA GERÊNCIA: ${observacao}`,
      canalId: interaction.channelId,
      canalNome: interaction.channel?.name || "canal-desconhecido",
      tipo: "controle_bau",
      acao: "liberar",
      cargo: "gerencia",
      registradoEm: new Date()
    });

    await enviarLogBonito(client, {
      color: 0x5865f2,
      title: "🔄 Transferência para o Controle de Baú",
      description: "Item saiu do baú da gerência e entrou no controle de baú.",
      fields: [
        criarCampo("📦 Item", `**${formatarNomeBonito(itemNormalizado)}**`),
        criarCampo("🔢 Quantidade", `**${formatarQuantidade(quantidade)}**`),
        criarCampo("📉 Gerência agora", `**${formatarQuantidade(registroGerencia.quantidade)}**`),
        criarCampo("📈 Controle agora", `**${formatarQuantidade(registroControle.quantidade)}**`),
        criarCampo("👤 Responsável", `**${interaction.user.username}**`),
        criarCampo("📝 Observação", observacao, false)
      ]
    });
  }

  const embed = new EmbedBuilder()
    .setColor(
      acao === "entrada" ? 0x57f287 :
      acao === "saida" ? 0xed4245 :
      0x5865f2
    )
    .setTitle(
      acao === "entrada"
        ? "✅ Entrada registrada"
        : acao === "saida"
        ? "✅ Saída registrada"
        : "✅ Transferência realizada"
    )
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
        name: "📊 Estoque gerência",
        value: `**${formatarQuantidade(registroGerencia.quantidade)}**`,
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

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, "ver");
  }

  if (!validarCanalPorAcao("ver", interaction.channel)) {
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
    .setFooter({ text: "SINNERS BOT • Estoque principal" })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    flags: 64
  });
}

module.exports = {
  BAU_BUTTON_ENTRADA,
  BAU_BUTTON_SAIDA,
  BAU_BUTTON_TRANSFERIR,
  BAU_BUTTON_VER,
  BAU_SELECT_ENTRADA,
  BAU_SELECT_SAIDA,
  BAU_SELECT_TRANSFERIR,
  BAU_MODAL_PREFIX,
  abrirSelecaoEntradaBau,
  abrirSelecaoSaidaBau,
  abrirSelecaoTransferirBau,
  processarModalBauGerencia,
  processarSelecaoBauGerencia,
  verEstoqueBauGerencia,
  criarPainelBau
};