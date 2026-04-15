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

const crypto = require("crypto");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const { podeUsarControleBau } = require("./permissoes");
const { itensGerais, itensArmas } = require("../config/config");
const { isForumComandoBot, criarLinkCanal } = require("./redirecionamentoForum");
const { enviarLogBonito, criarCampo } = require("./logMovimentacaoBonita");

const CONTROLE_BUTTON_RETIRAR = "controle_bau_retirar";
const CONTROLE_BUTTON_DEVOLVER = "controle_bau_devolver";
const CONTROLE_BUTTON_VER = "controle_bau_ver";

const CONTROLE_SELECT_CATEGORIA = "controle_bau_select_categoria";
const CONTROLE_SELECT_ITEM = "controle_bau_select_item";

const CONTROLE_BUTTON_VOLTAR = "controle_bau_voltar";
const CONTROLE_BUTTON_CANCELAR = "controle_bau_cancelar";
const CONTROLE_BUTTON_CONFIRMAR = "controle_bau_confirmar";

const CONTROLE_MODAL_QUANTIDADE = "controle_bau_modal_quantidade";

const CANAL_CONTROLE_ENTRADA = "1480507568265760812";
const CANAL_CONTROLE_SAIDA = "1480507568265760814";

const sessoesControleBau = new Map();

function gerarToken() {
  return crypto.randomBytes(8).toString("hex");
}

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

function formatarQuantidade(valor) {
  return new Intl.NumberFormat("pt-BR").format(Number(valor) || 0);
}

function getTipoItem(item) {
  const nome = normalizarItem(item);
  if (itensArmas.map(normalizarItem).includes(nome)) return "arma";
  return "geral";
}

function getCategorias() {
  return [
    {
      key: "drogas",
      label: "Drogas",
      itens: ["cocaina", "maconha", "metanfetamina"]
    },
    {
      key: "armas",
      label: "Armas",
      itens: ["g36c mk2", "mp5", "fn five seven", "hhk"]
    },
    {
      key: "municoes",
      label: "Munições",
      itens: ["municao rifle", "municao pistola", "municao submetralhadora"]
    },
    {
      key: "acao",
      label: "Itens de ação",
      itens: ["explosivo c4", "hacking", "furadeira", "lockpick", "envelope manchado", "chip ilegal"]
    },
    {
      key: "utilitarios",
      label: "Utilitários",
      itens: ["algemas", "adrenalina", "capuz", "celular", "radio", "chave", "galao"]
    },
    {
      key: "valores",
      label: "Valores",
      itens: ["dinheiro sujo"]
    }
  ];
}

function encontrarCategoriaPorKey(key) {
  return getCategorias().find((categoria) => categoria.key === key) || null;
}

function canalEhEntrada(channel) {
  if (!channel) return false;
  const id = String(channel.id);
  const nome = normalizarTexto(channel.name);
  return id === CANAL_CONTROLE_ENTRADA || nome === "entrada";
}

function canalEhSaida(channel) {
  if (!channel) return false;
  const id = String(channel.id);
  const nome = normalizarTexto(channel.name);
  return id === CANAL_CONTROLE_SAIDA || nome === "saida";
}

function validarCanalPorAcao(acao, channel) {
  if (acao === "devolver") return canalEhEntrada(channel);
  if (acao === "retirar") return canalEhSaida(channel);
  if (acao === "ver") return canalEhEntrada(channel) || canalEhSaida(channel);
  return false;
}

function mensagemCanalInvalido(acao, channel) {
  const atual = channel?.name ? `\n📍 Canal atual: **#${channel.name}**` : "";

  if (acao === "devolver") {
    return `❌ Use este painel no canal de **entrada** do controle de baú para devolver item ao estoque liberado.${atual}`;
  }

  if (acao === "retirar") {
    return `❌ Use este painel no canal de **saída** do controle de baú para registrar retirada dos membros.${atual}`;
  }

  return `❌ Use este painel no canal correto do controle de baú.${atual}`;
}

function responderRedirecionamentoForum(interaction, acao) {
  let canalId = "";
  let titulo = "";
  let descricao = "";

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
    .setDescription([descricao, "", "Clique no botão abaixo para abrir o canal certo."].join("\n"))
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
        "A **liberação** acontece quando a gerência usa **Transferir p/ Controle** no baú da gerência.",
        "",
        "**Fluxo certo:**",
        "1. item sai do **baú da gerência**",
        "2. entra no **controle de baú**",
        "3. membro **retira** para usar",
        "4. se sobrar, **devolve** para o controle",
        "",
        "**Regras deste painel:**",
        "• **Devolver item** → canal **entrada**",
        "• **Retirar item** → canal **saída**",
        "• **Ver estoque** → funciona nos dois",
        "",
        "Agora o painel usa:",
        "• categoria",
        "• item",
        "• quantidade",
        "• confirmação",
        "• voltar / cancelar"
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Controle de Baú" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
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

function criarEmbedCategoria(acao) {
  const titulo = acao === "retirar" ? "📤 Retirar item" : "📥 Devolver item";

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(titulo)
    .setDescription(
      [
        "**Etapa 1 de 4**",
        "Escolha a categoria do produto."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Controle de Baú" })
    .setTimestamp();
}

function criarSelectCategoria(token) {
  const categorias = getCategorias();

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CONTROLE_SELECT_CATEGORIA}:${token}`)
      .setPlaceholder("Selecione a categoria")
      .addOptions(
        categorias.map((categoria) => ({
          label: categoria.label,
          value: categoria.key,
          description: `Abrir categoria ${categoria.label}`
        }))
      )
  );
}

function criarEmbedItem(sessao, itensDisponiveis = []) {
  const categoria = encontrarCategoriaPorKey(sessao.categoriaKey);
  const titulo = sessao.acao === "retirar" ? "📤 Retirar item" : "📥 Devolver item";

  const linhas = [
    `**Etapa 2 de 4**`,
    `Categoria: **${categoria?.label || "Não identificada"}**`,
    "",
    "Escolha o item."
  ];

  if (sessao.acao === "retirar" && itensDisponiveis.length) {
    linhas.push("", "**Itens com estoque:**");
    for (const registro of itensDisponiveis.slice(0, 10)) {
      linhas.push(`• ${formatarNomeBonito(registro.item)} — ${formatarQuantidade(registro.quantidade)}`);
    }
  }

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(titulo)
    .setDescription(linhas.join("\n"))
    .setFooter({ text: "SINNERS BOT • Controle de Baú" })
    .setTimestamp();
}

function criarSelectItem(token, sessao, itensDisponiveis = []) {
  const categoria = encontrarCategoriaPorKey(sessao.categoriaKey);
  let opcoes = [];

  if (sessao.acao === "retirar") {
    opcoes = itensDisponiveis
      .filter((registro) => categoria.itens.includes(normalizarItem(registro.item)))
      .map((registro) => ({
        label: formatarNomeBonito(registro.item),
        value: normalizarItem(registro.item),
        description: `Estoque atual: ${formatarQuantidade(registro.quantidade)}`
      }));
  } else {
    opcoes = categoria.itens.map((item) => ({
      label: formatarNomeBonito(item),
      value: normalizarItem(item),
      description: "Adicionar de volta ao controle"
    }));
  }

  if (!opcoes.length) {
    opcoes = [{
      label: "Sem itens disponíveis",
      value: "__sem_itens__",
      description: "Nenhum item encontrado nesta categoria"
    }];
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CONTROLE_SELECT_ITEM}:${token}`)
      .setPlaceholder("Selecione o item")
      .addOptions(opcoes.slice(0, 25))
  );
}

function criarEmbedConfirmacao(sessao, estoqueAtual) {
  const titulo = sessao.acao === "retirar" ? "✅ Confirmar retirada" : "✅ Confirmar devolução";

  return new EmbedBuilder()
    .setColor(sessao.acao === "retirar" ? 0xed4245 : 0x57f287)
    .setTitle(titulo)
    .setDescription(
      [
        `**Etapa 4 de 4**`,
        `Ação: **${sessao.acao}**`,
        `Categoria: **${encontrarCategoriaPorKey(sessao.categoriaKey)?.label || "Não identificada"}**`,
        `Item: **${formatarNomeBonito(sessao.item)}**`,
        `Quantidade: **${formatarQuantidade(sessao.quantidade)}**`,
        `Estoque atual: **${formatarQuantidade(estoqueAtual)}**`,
        `Estoque após ação: **${formatarQuantidade(sessao.acao === "retirar" ? estoqueAtual - sessao.quantidade : estoqueAtual + sessao.quantidade)}**`,
        `Observação: **${sessao.observacao || "Sem observação"}**`
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Confirmação" })
    .setTimestamp();
}

function criarBotoesNavegacao(token, etapaAtual, podeConfirmar = false) {
  const row = new ActionRowBuilder();

  if (etapaAtual !== "categoria") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CONTROLE_BUTTON_VOLTAR}:${token}`)
        .setLabel("Voltar")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${CONTROLE_BUTTON_CANCELAR}:${token}`)
      .setLabel("Cancelar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary)
  );

  if (podeConfirmar) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CONTROLE_BUTTON_CONFIRMAR}:${token}`)
        .setLabel("Confirmar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );
  }

  return row;
}

async function abrirFluxoControle(interaction, acao) {
  if (!podeUsarControleBau(interaction.member)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para usar este painel.",
      flags: 64
    });
  }

  if (isForumComandoBot(interaction.channel)) {
    return responderRedirecionamentoForum(interaction, acao);
  }

  if (!validarCanalPorAcao(acao, interaction.channel)) {
    return interaction.reply({
      content: mensagemCanalInvalido(acao, interaction.channel),
      flags: 64
    });
  }

  const token = gerarToken();

  sessoesControleBau.set(token, {
    token,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    acao,
    etapa: "categoria",
    categoriaKey: null,
    item: null,
    quantidade: null,
    observacao: null
  });

  return interaction.reply({
    embeds: [criarEmbedCategoria(acao)],
    components: [
      criarSelectCategoria(token),
      criarBotoesNavegacao(token, "categoria")
    ],
    flags: 64
  });
}

async function abrirSelecaoRetirar(interaction) {
  return abrirFluxoControle(interaction, "retirar");
}

async function abrirSelecaoDevolver(interaction) {
  return abrirFluxoControle(interaction, "devolver");
}

async function processarSelecaoCategoria(interaction, token) {
  const sessao = sessoesControleBau.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Abra o painel novamente.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  const categoriaKey = interaction.values?.[0];
  sessao.categoriaKey = categoriaKey;
  sessao.etapa = "item";
  sessoesControleBau.set(token, sessao);

  let itensDisponiveis = [];
  if (sessao.acao === "retirar") {
    itensDisponiveis = await ControleBau.find({
      item: { $not: /^gerencia_/i },
      quantidade: { $gt: 0 }
    }).sort({ item: 1 });
  }

  return interaction.update({
    embeds: [criarEmbedItem(sessao, itensDisponiveis)],
    components: [
      criarSelectItem(token, sessao, itensDisponiveis),
      criarBotoesNavegacao(token, "item")
    ]
  });
}

async function processarSelecaoItem(interaction, token) {
  const sessao = sessoesControleBau.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Abra o painel novamente.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  const item = interaction.values?.[0];
  if (item === "__sem_itens__") {
    return interaction.reply({
      content: "❌ Não há itens disponíveis nesta categoria.",
      flags: 64
    });
  }

  sessao.item = item;
  sessao.etapa = "quantidade";
  sessoesControleBau.set(token, sessao);

  const modal = new ModalBuilder()
    .setCustomId(`${CONTROLE_MODAL_QUANTIDADE}:${token}`)
    .setTitle(`Controle de Baú • ${sessao.acao}`);

  const quantidade = new TextInputBuilder()
    .setCustomId("quantidade")
    .setLabel("Quantidade")
    .setPlaceholder("Ex: 10")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const observacao = new TextInputBuilder()
    .setCustomId("observacao")
    .setLabel("Observação")
    .setPlaceholder("Ex: ação, patrulha, devolução")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidade),
    new ActionRowBuilder().addComponents(observacao)
  );

  return interaction.showModal(modal);
}

async function processarModalQuantidade(interaction, token) {
  const sessao = sessoesControleBau.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Abra o painel novamente.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
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

  let registro = await ControleBau.findOne({ item: normalizarItem(sessao.item) });

  if (!registro) {
    registro = new ControleBau({
      item: normalizarItem(sessao.item),
      quantidade: 0,
      tipo: getTipoItem(sessao.item)
    });
  }

  if (sessao.acao === "retirar" && registro.quantidade < quantidade) {
    return interaction.reply({
      content: `❌ Estoque insuficiente para retirar. Atual: **${formatarQuantidade(registro.quantidade)}**`,
      flags: 64
    });
  }

  sessao.quantidade = quantidade;
  sessao.observacao = observacao;
  sessao.etapa = "confirmacao";
  sessoesControleBau.set(token, sessao);

  return interaction.reply({
    embeds: [criarEmbedConfirmacao(sessao, registro.quantidade)],
    components: [criarBotoesNavegacao(token, "confirmacao", true)],
    flags: 64
  });
}

async function voltarFluxo(interaction, token) {
  const sessao = sessoesControleBau.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Abra o painel novamente.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode continuar.",
      flags: 64
    });
  }

  if (sessao.etapa === "item") {
    sessao.categoriaKey = null;
    sessao.etapa = "categoria";
    sessoesControleBau.set(token, sessao);

    return interaction.update({
      embeds: [criarEmbedCategoria(sessao.acao)],
      components: [
        criarSelectCategoria(token),
        criarBotoesNavegacao(token, "categoria")
      ]
    });
  }

  if (sessao.etapa === "confirmacao") {
    sessao.quantidade = null;
    sessao.observacao = null;
    sessao.etapa = "item";
    sessoesControleBau.set(token, sessao);

    let itensDisponiveis = [];
    if (sessao.acao === "retirar") {
      itensDisponiveis = await ControleBau.find({
        item: { $not: /^gerencia_/i },
        quantidade: { $gt: 0 }
      }).sort({ item: 1 });
    }

    return interaction.update({
      embeds: [criarEmbedItem(sessao, itensDisponiveis)],
      components: [
        criarSelectItem(token, sessao, itensDisponiveis),
        criarBotoesNavegacao(token, "item")
      ]
    });
  }

  return interaction.reply({
    content: "❌ Não há etapa anterior disponível.",
    flags: 64
  });
}

async function cancelarFluxo(interaction, token) {
  const sessao = sessoesControleBau.get(token);

  if (sessao && sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode cancelar.",
      flags: 64
    });
  }

  sessoesControleBau.delete(token);

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({
      content: "❌ Operação cancelada.",
      flags: 64
    });
  }

  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    return interaction.update({
      content: "❌ Operação cancelada.",
      embeds: [],
      components: []
    });
  }

  return interaction.reply({
    content: "❌ Operação cancelada.",
    flags: 64
  });
}

async function confirmarFluxo(interaction, token) {
  const sessao = sessoesControleBau.get(token);

  if (!sessao) {
    return interaction.reply({
      content: "❌ Esta sessão expirou. Abra o painel novamente.",
      flags: 64
    });
  }

  if (sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode confirmar.",
      flags: 64
    });
  }

  let registro = await ControleBau.findOne({ item: normalizarItem(sessao.item) });

  if (!registro) {
    registro = new ControleBau({
      item: normalizarItem(sessao.item),
      quantidade: 0,
      tipo: getTipoItem(sessao.item)
    });
  }

  if (sessao.acao === "retirar" && registro.quantidade < sessao.quantidade) {
    sessoesControleBau.delete(token);
    return interaction.update({
      content: `❌ Estoque insuficiente para retirar. Atual: **${formatarQuantidade(registro.quantidade)}**`,
      embeds: [],
      components: []
    });
  }

  if (sessao.acao === "retirar") registro.quantidade -= sessao.quantidade;
  if (sessao.acao === "devolver") registro.quantidade += sessao.quantidade;

  await registro.save();

  await MovimentacaoBau.create({
    userId: interaction.user.id,
    username: interaction.user.username,
    item: normalizarItem(sessao.item),
    quantidade: sessao.quantidade,
    tipoMovimentacao: sessao.acao,
    observacao: sessao.observacao || "Sem observação",
    canalId: interaction.channelId,
    canalNome: interaction.channel?.name || "canal-desconhecido",
    tipo: "controle_bau",
    acao: sessao.acao,
    cargo: "membro",
    registradoEm: new Date()
  });

  await enviarLogBonito(interaction.client, {
    color: sessao.acao === "retirar" ? 0xed4245 : 0x5865f2,
    title:
      sessao.acao === "retirar"
        ? "📤 Item retirado do Controle de Baú"
        : "📥 Item devolvido ao Controle de Baú",
    description: "Movimentação registrada no estoque liberado aos membros.",
    fields: [
      criarCampo("📦 Item", `**${formatarNomeBonito(sessao.item)}**`),
      criarCampo("🔢 Quantidade", `**${formatarQuantidade(sessao.quantidade)}**`),
      criarCampo("📊 Estoque atual", `**${formatarQuantidade(registro.quantidade)}**`),
      criarCampo("👤 Responsável", `**${interaction.user.username}**`),
      criarCampo("📝 Observação", sessao.observacao || "Sem observação", false)
    ]
  });

  const embed = new EmbedBuilder()
    .setColor(sessao.acao === "retirar" ? 0xed4245 : 0x5865f2)
    .setTitle("✅ Movimentação registrada")
    .addFields(
      { name: "📦 Item", value: `**${formatarNomeBonito(sessao.item)}**`, inline: true },
      { name: "⚙️ Ação", value: `**${sessao.acao}**`, inline: true },
      { name: "🔢 Quantidade", value: `**${formatarQuantidade(sessao.quantidade)}**`, inline: true },
      { name: "📊 Estoque atual", value: `**${formatarQuantidade(registro.quantidade)}**`, inline: true },
      { name: "📝 Observação", value: sessao.observacao || "Sem observação", inline: false }
    )
    .setFooter({ text: "SINNERS BOT • Controle de Baú" })
    .setTimestamp();

  sessoesControleBau.delete(token);

  return interaction.update({
    embeds: [embed],
    components: []
  });
}

async function processarSelecaoControleBau(interaction) {
  const [prefixo, token] = interaction.customId.split(":");

  if (prefixo === CONTROLE_SELECT_CATEGORIA) {
    return processarSelecaoCategoria(interaction, token);
  }

  if (prefixo === CONTROLE_SELECT_ITEM) {
    return processarSelecaoItem(interaction, token);
  }
}

async function processarModalControleBau(interaction) {
  const [, token] = interaction.customId.split(":");
  return processarModalQuantidade(interaction, token);
}

async function processarBotaoControleBau(interaction) {
  if (interaction.customId.startsWith(`${CONTROLE_BUTTON_VOLTAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return voltarFluxo(interaction, token);
  }

  if (interaction.customId.startsWith(`${CONTROLE_BUTTON_CANCELAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return cancelarFluxo(interaction, token);
  }

  if (interaction.customId.startsWith(`${CONTROLE_BUTTON_CONFIRMAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return confirmarFluxo(interaction, token);
  }
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

  if (!validarCanalPorAcao("ver", interaction.channel)) {
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
  CONTROLE_BUTTON_RETIRAR,
  CONTROLE_BUTTON_DEVOLVER,
  CONTROLE_BUTTON_VER,
  CONTROLE_SELECT_CATEGORIA,
  CONTROLE_SELECT_ITEM,
  CONTROLE_BUTTON_VOLTAR,
  CONTROLE_BUTTON_CANCELAR,
  CONTROLE_BUTTON_CONFIRMAR,
  CONTROLE_MODAL_QUANTIDADE,
  abrirSelecaoRetirar,
  abrirSelecaoDevolver,
  processarSelecaoControleBau,
  processarModalControleBau,
  processarBotaoControleBau,
  verEstoqueControleBau,
  criarPainelControleBau
};