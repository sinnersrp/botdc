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
const { podeUsarBauGerencia } = require("./permissoes");
const { isForumComandoBot, criarLinkCanal } = require("./redirecionamentoForum");
const { enviarLogBonito, criarCampo } = require("./logMovimentacaoBonita");

const BAU_BUTTON_ENTRADA = "bau_gerencia_entrada";
const BAU_BUTTON_SAIDA = "bau_gerencia_saida";
const BAU_BUTTON_TRANSFERIR = "bau_gerencia_transferir";
const BAU_BUTTON_VER = "bau_gerencia_ver";

const BAU_SELECT_CATEGORIA = "bau_gerencia_select_categoria";
const BAU_SELECT_ITEM = "bau_gerencia_select_item";

const BAU_BUTTON_VOLTAR = "bau_gerencia_voltar";
const BAU_BUTTON_CANCELAR = "bau_gerencia_cancelar";
const BAU_BUTTON_CONFIRMAR = "bau_gerencia_confirmar";

const BAU_MODAL_QUANTIDADE = "bau_gerencia_modal_quantidade";

const CANAL_BAU_ENTRADA = "1486811209565995169";
const CANAL_BAU_SAIDA = "1486811278281408512";

const sessoesBauGerencia = new Map();

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

function getItemDb(item) {
  return `gerencia_${normalizarItem(item)}`;
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
    return `❌ Use este painel no canal de **entrada-bau** para registrar produtos recebidos dos fornecedores.${atual}`;
  }

  if (acao === "saida") {
    return `❌ Use este painel no canal de **saida-bau** para retirar itens do estoque principal.${atual}`;
  }

  if (acao === "transferir") {
    return `❌ Use este painel no canal de **saida-bau** para transferir itens para o controle de baú.${atual}`;
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
        "Agora o painel usa:",
        "• categoria",
        "• item",
        "• quantidade",
        "• confirmação",
        "• voltar / cancelar"
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

function criarEmbedCategoria(acao) {
  const titulo =
    acao === "entrada"
      ? "📥 Entrada no baú"
      : acao === "saida"
      ? "📤 Saída no baú"
      : "🔄 Transferir para controle";

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(titulo)
    .setDescription(
      [
        "**Etapa 1 de 4**",
        "Escolha a categoria do produto."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Baú da Gerência" })
    .setTimestamp();
}

function criarSelectCategoria(token) {
  const categorias = getCategorias();

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${BAU_SELECT_CATEGORIA}:${token}`)
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
  const titulo =
    sessao.acao === "entrada"
      ? "📥 Entrada no baú"
      : sessao.acao === "saida"
      ? "📤 Saída no baú"
      : "🔄 Transferir para controle";

  const linhas = [
    `**Etapa 2 de 4**`,
    `Categoria: **${categoria?.label || "Não identificada"}**`,
    "",
    "Escolha o item."
  ];

  if ((sessao.acao === "saida" || sessao.acao === "transferir") && itensDisponiveis.length) {
    linhas.push("", "**Itens com estoque:**");
    for (const registro of itensDisponiveis.slice(0, 10)) {
      const itemOriginal = String(registro.item).replace(/^gerencia_/i, "");
      linhas.push(`• ${formatarNomeBonito(itemOriginal)} — ${formatarQuantidade(registro.quantidade)}`);
    }
  }

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(titulo)
    .setDescription(linhas.join("\n"))
    .setFooter({ text: "SINNERS BOT • Baú da Gerência" })
    .setTimestamp();
}

function criarSelectItem(token, sessao, itensDisponiveis = []) {
  const categoria = encontrarCategoriaPorKey(sessao.categoriaKey);
  let opcoes = [];

  if (sessao.acao === "entrada") {
    opcoes = categoria.itens.map((item) => ({
      label: formatarNomeBonito(item),
      value: normalizarItem(item),
      description: "Adicionar ao baú da gerência"
    }));
  } else {
    opcoes = itensDisponiveis
      .filter((registro) => {
        const base = String(registro.item).replace(/^gerencia_/i, "");
        return categoria.itens.includes(normalizarItem(base));
      })
      .map((registro) => {
        const base = String(registro.item).replace(/^gerencia_/i, "");
        return {
          label: formatarNomeBonito(base),
          value: normalizarItem(base),
          description: `Estoque atual: ${formatarQuantidade(registro.quantidade)}`
        };
      });
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
      .setCustomId(`${BAU_SELECT_ITEM}:${token}`)
      .setPlaceholder("Selecione o item")
      .addOptions(opcoes.slice(0, 25))
  );
}

function criarEmbedConfirmacao(sessao, estoqueGerenciaAtual, estoqueControleAtual = null) {
  const titulo =
    sessao.acao === "entrada"
      ? "✅ Confirmar entrada"
      : sessao.acao === "saida"
      ? "✅ Confirmar saída"
      : "✅ Confirmar transferência";

  const linhas = [
    `**Etapa 4 de 4**`,
    `Ação: **${sessao.acao}**`,
    `Categoria: **${encontrarCategoriaPorKey(sessao.categoriaKey)?.label || "Não identificada"}**`,
    `Item: **${formatarNomeBonito(sessao.item)}**`,
    `Quantidade: **${formatarQuantidade(sessao.quantidade)}**`,
    `Estoque atual na gerência: **${formatarQuantidade(estoqueGerenciaAtual)}**`,
    `Estoque após ação na gerência: **${formatarQuantidade(
      sessao.acao === "entrada"
        ? estoqueGerenciaAtual + sessao.quantidade
        : estoqueGerenciaAtual - sessao.quantidade
    )}**`
  ];

  if (sessao.acao === "transferir" && estoqueControleAtual !== null) {
    linhas.push(
      `Estoque atual no controle: **${formatarQuantidade(estoqueControleAtual)}**`,
      `Estoque após transferência no controle: **${formatarQuantidade(estoqueControleAtual + sessao.quantidade)}**`
    );
  }

  linhas.push(`Observação: **${sessao.observacao || "Sem observação"}**`);

  return new EmbedBuilder()
    .setColor(
      sessao.acao === "entrada" ? 0x57f287 :
      sessao.acao === "saida" ? 0xed4245 :
      0x5865f2
    )
    .setTitle(titulo)
    .setDescription(linhas.join("\n"))
    .setFooter({ text: "SINNERS BOT • Confirmação" })
    .setTimestamp();
}

function criarBotoesNavegacao(token, etapaAtual, podeConfirmar = false) {
  const row = new ActionRowBuilder();

  if (etapaAtual !== "categoria") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${BAU_BUTTON_VOLTAR}:${token}`)
        .setLabel("Voltar")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${BAU_BUTTON_CANCELAR}:${token}`)
      .setLabel("Cancelar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary)
  );

  if (podeConfirmar) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${BAU_BUTTON_CONFIRMAR}:${token}`)
        .setLabel("Confirmar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );
  }

  return row;
}

async function abrirFluxoBau(interaction, acao) {
  if (!podeUsarBauGerencia(interaction.member)) {
    return interaction.reply({
      content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este painel.",
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

  sessoesBauGerencia.set(token, {
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

async function abrirSelecaoEntradaBau(interaction) {
  return abrirFluxoBau(interaction, "entrada");
}

async function abrirSelecaoSaidaBau(interaction) {
  return abrirFluxoBau(interaction, "saida");
}

async function abrirSelecaoTransferirBau(interaction) {
  return abrirFluxoBau(interaction, "transferir");
}

async function processarSelecaoCategoria(interaction, token) {
  const sessao = sessoesBauGerencia.get(token);

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
  sessoesBauGerencia.set(token, sessao);

  let itensDisponiveis = [];
  if (sessao.acao === "saida" || sessao.acao === "transferir") {
    itensDisponiveis = await ControleBau.find({
      item: { $regex: /^gerencia_/i },
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
  const sessao = sessoesBauGerencia.get(token);

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
  sessoesBauGerencia.set(token, sessao);

  const modal = new ModalBuilder()
    .setCustomId(`${BAU_MODAL_QUANTIDADE}:${token}`)
    .setTitle(`Baú da Gerência • ${sessao.acao}`);

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
    .setPlaceholder("Ex: fornecedor entregou / reposição / transferido")
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
  const sessao = sessoesBauGerencia.get(token);

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

  const itemDb = getItemDb(sessao.item);

  let registroGerencia = await ControleBau.findOne({ item: itemDb });
  if (!registroGerencia) {
    registroGerencia = new ControleBau({
      item: itemDb,
      quantidade: 0,
      tipo: "geral"
    });
  }

  if ((sessao.acao === "saida" || sessao.acao === "transferir") && registroGerencia.quantidade < quantidade) {
    return interaction.reply({
      content: `❌ Estoque insuficiente. Atual na gerência: **${formatarQuantidade(registroGerencia.quantidade)}**`,
      flags: 64
    });
  }

  sessao.quantidade = quantidade;
  sessao.observacao = observacao;
  sessao.etapa = "confirmacao";
  sessoesBauGerencia.set(token, sessao);

  let estoqueControleAtual = null;
  if (sessao.acao === "transferir") {
    const registroControle = await ControleBau.findOne({ item: normalizarItem(sessao.item) });
    estoqueControleAtual = Number(registroControle?.quantidade || 0);
  }

  return interaction.reply({
    embeds: [criarEmbedConfirmacao(sessao, Number(registroGerencia.quantidade || 0), estoqueControleAtual)],
    components: [criarBotoesNavegacao(token, "confirmacao", true)],
    flags: 64
  });
}

async function voltarFluxo(interaction, token) {
  const sessao = sessoesBauGerencia.get(token);

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
    sessoesBauGerencia.set(token, sessao);

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
    sessoesBauGerencia.set(token, sessao);

    let itensDisponiveis = [];
    if (sessao.acao === "saida" || sessao.acao === "transferir") {
      itensDisponiveis = await ControleBau.find({
        item: { $regex: /^gerencia_/i },
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
  const sessao = sessoesBauGerencia.get(token);

  if (sessao && sessao.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Apenas quem abriu este fluxo pode cancelar.",
      flags: 64
    });
  }

  sessoesBauGerencia.delete(token);

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
  const sessao = sessoesBauGerencia.get(token);

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

  const itemDb = getItemDb(sessao.item);

  let registroGerencia = await ControleBau.findOne({ item: itemDb });
  if (!registroGerencia) {
    registroGerencia = new ControleBau({
      item: itemDb,
      quantidade: 0,
      tipo: "geral"
    });
  }

  if ((sessao.acao === "saida" || sessao.acao === "transferir") && registroGerencia.quantidade < sessao.quantidade) {
    sessoesBauGerencia.delete(token);
    return interaction.update({
      content: `❌ Estoque insuficiente. Atual na gerência: **${formatarQuantidade(registroGerencia.quantidade)}**`,
      embeds: [],
      components: []
    });
  }

  if (sessao.acao === "entrada") {
    registroGerencia.quantidade += sessao.quantidade;
    await registroGerencia.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.username,
      item: itemDb,
      itemOriginal: normalizarItem(sessao.item),
      quantidade: sessao.quantidade,
      tipoMovimentacao: "entrada",
      observacao: sessao.observacao || "Sem observação",
      canalId: interaction.channelId,
      canalNome: interaction.channel?.name || "canal-desconhecido",
      tipo: "bau_gerencia",
      acao: "entrada",
      cargo: "gerencia",
      registradoEm: new Date()
    });

    await enviarLogBonito(interaction.client, {
      color: 0x57f287,
      title: "📥 Entrada no Baú da Gerência",
      description: "Produto recebido dos fornecedores e registrado no estoque principal.",
      fields: [
        criarCampo("📦 Item", `**${formatarNomeBonito(sessao.item)}**`),
        criarCampo("🔢 Quantidade", `**${formatarQuantidade(sessao.quantidade)}**`),
        criarCampo("📊 Estoque atual", `**${formatarQuantidade(registroGerencia.quantidade)}**`),
        criarCampo("👤 Responsável", `**${interaction.user.username}**`),
        criarCampo("📝 Observação", sessao.observacao || "Sem observação", false)
      ]
    });
  }

  if (sessao.acao === "saida") {
    registroGerencia.quantidade -= sessao.quantidade;
    await registroGerencia.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.username,
      item: itemDb,
      itemOriginal: normalizarItem(sessao.item),
      quantidade: sessao.quantidade,
      tipoMovimentacao: "saida",
      observacao: sessao.observacao || "Sem observação",
      canalId: interaction.channelId,
      canalNome: interaction.channel?.name || "canal-desconhecido",
      tipo: "bau_gerencia",
      acao: "saida",
      cargo: "gerencia",
      registradoEm: new Date()
    });

    await enviarLogBonito(interaction.client, {
      color: 0xed4245,
      title: "📤 Saída no Baú da Gerência",
      description: "Item retirado do estoque principal.",
      fields: [
        criarCampo("📦 Item", `**${formatarNomeBonito(sessao.item)}**`),
        criarCampo("🔢 Quantidade", `**${formatarQuantidade(sessao.quantidade)}**`),
        criarCampo("📊 Estoque atual", `**${formatarQuantidade(registroGerencia.quantidade)}**`),
        criarCampo("👤 Responsável", `**${interaction.user.username}**`),
        criarCampo("📝 Observação", sessao.observacao || "Sem observação", false)
      ]
    });
  }

  if (sessao.acao === "transferir") {
    registroGerencia.quantidade -= sessao.quantidade;
    await registroGerencia.save();

    let registroControle = await ControleBau.findOne({ item: normalizarItem(sessao.item) });
    if (!registroControle) {
      registroControle = new ControleBau({
        item: normalizarItem(sessao.item),
        quantidade: 0,
        tipo: "geral"
      });
    }

    registroControle.quantidade += sessao.quantidade;
    await registroControle.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.username,
      item: itemDb,
      itemOriginal: normalizarItem(sessao.item),
      quantidade: sessao.quantidade,
      tipoMovimentacao: "transferencia_controle",
      observacao: sessao.observacao || "Sem observação",
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
      item: normalizarItem(sessao.item),
      quantidade: sessao.quantidade,
      tipoMovimentacao: "liberar",
      observacao: `TRANSFERIDO DA GERÊNCIA: ${sessao.observacao || "Sem observação"}`,
      canalId: interaction.channelId,
      canalNome: interaction.channel?.name || "canal-desconhecido",
      tipo: "controle_bau",
      acao: "liberar",
      cargo: "gerencia",
      registradoEm: new Date()
    });

    await enviarLogBonito(interaction.client, {
      color: 0x5865f2,
      title: "🔄 Transferência para o Controle de Baú",
      description: "Item saiu do baú da gerência e entrou no controle de baú.",
      fields: [
        criarCampo("📦 Item", `**${formatarNomeBonito(sessao.item)}**`),
        criarCampo("🔢 Quantidade", `**${formatarQuantidade(sessao.quantidade)}**`),
        criarCampo("📉 Gerência agora", `**${formatarQuantidade(registroGerencia.quantidade)}**`),
        criarCampo("📈 Controle agora", `**${formatarQuantidade(registroControle.quantidade)}**`),
        criarCampo("👤 Responsável", `**${interaction.user.username}**`),
        criarCampo("📝 Observação", sessao.observacao || "Sem observação", false)
      ]
    });
  }

  const embed = new EmbedBuilder()
    .setColor(
      sessao.acao === "entrada" ? 0x57f287 :
      sessao.acao === "saida" ? 0xed4245 :
      0x5865f2
    )
    .setTitle(
      sessao.acao === "entrada"
        ? "✅ Entrada registrada"
        : sessao.acao === "saida"
        ? "✅ Saída registrada"
        : "✅ Transferência realizada"
    )
    .addFields(
      {
        name: "📦 Item",
        value: `**${formatarNomeBonito(sessao.item)}**`,
        inline: true
      },
      {
        name: "🔢 Quantidade",
        value: `**${formatarQuantidade(sessao.quantidade)}**`,
        inline: true
      },
      {
        name: "📊 Estoque gerência",
        value: `**${formatarQuantidade(registroGerencia.quantidade)}**`,
        inline: true
      },
      {
        name: "📝 Observação",
        value: sessao.observacao || "Sem observação",
        inline: false
      }
    )
    .setFooter({ text: "SINNERS BOT • Baú da Gerência" })
    .setTimestamp();

  sessoesBauGerencia.delete(token);

  return interaction.update({
    embeds: [embed],
    components: []
  });
}

async function processarSelecaoBauGerencia(interaction, client) {
  const [prefixo, token] = interaction.customId.split(":");

  if (prefixo === BAU_SELECT_CATEGORIA) {
    return processarSelecaoCategoria(interaction, token);
  }

  if (prefixo === BAU_SELECT_ITEM) {
    return processarSelecaoItem(interaction, token);
  }
}

async function processarModalBauGerencia(interaction, client) {
  const [, token] = interaction.customId.split(":");
  return processarModalQuantidade(interaction, token);
}

async function processarBotaoBauGerencia(interaction) {
  if (interaction.customId.startsWith(`${BAU_BUTTON_VOLTAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return voltarFluxo(interaction, token);
  }

  if (interaction.customId.startsWith(`${BAU_BUTTON_CANCELAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return cancelarFluxo(interaction, token);
  }

  if (interaction.customId.startsWith(`${BAU_BUTTON_CONFIRMAR}:`)) {
    const [, token] = interaction.customId.split(":");
    return confirmarFluxo(interaction, token);
  }
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
  BAU_SELECT_CATEGORIA,
  BAU_SELECT_ITEM,
  BAU_BUTTON_VOLTAR,
  BAU_BUTTON_CANCELAR,
  BAU_BUTTON_CONFIRMAR,
  BAU_MODAL_QUANTIDADE,
  abrirSelecaoEntradaBau,
  abrirSelecaoSaidaBau,
  abrirSelecaoTransferirBau,
  processarSelecaoBauGerencia,
  processarModalBauGerencia,
  processarBotaoBauGerencia,
  verEstoqueBauGerencia,
  criarPainelBau
};