const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const {
  canais,
  cargosLiberacao,
  cargoMembroPadrao,
  cargoAmigos
} = require("../config/config");

const REGISTRO_BUTTON_ID = "registro_abrir_modal";
const REGISTRO_MODAL_ID = "registro_modal";

function normalizarTexto(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function limparNomeCanal(nome = "") {
  return normalizarTexto(nome)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function limparPassaporte(passaporte = "") {
  return String(passaporte)
    .replace(/[^0-9a-zA-Z-]/g, "")
    .slice(0, 20);
}

function criarPainelRegistro() {
  const botao = new ButtonBuilder()
    .setCustomId(REGISTRO_BUTTON_ID)
    .setLabel("Fazer registro")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(botao);

  return {
    content: [
      "📋 **REGISTRO DE NOVO MEMBRO**",
      "",
      "Clique no botão abaixo para preencher seu registro.",
      "Preencha corretamente:",
      "• Nome",
      "• Passaporte",
      "• Número em game"
    ].join("\n"),
    components: [row]
  };
}

async function buscarCanalFarmExistente(guild, userId) {
  return guild.channels.cache.find((channel) => {
    if (channel.parentId !== canais.categoriaFarmPrivado) return false;
    return channel.topic === `farm:${userId}`;
  }) || null;
}

async function restaurarCanalSeExistir(canal, member) {
  const permissionOverwrites = [...canal.permissionOverwrites.cache.values()]
    .map((overwrite) => ({
      id: overwrite.id,
      allow: overwrite.allow.bitfield.toString(),
      deny: overwrite.deny.bitfield.toString()
    }))
    .filter((overwrite) => overwrite.id !== member.id);

  permissionOverwrites.push({
    id: member.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks
    ]
  });

  let novoNome = canal.name;
  if (novoNome.startsWith("arquivado-")) {
    novoNome = novoNome.replace(/^arquivado-/, "");
  }

  await canal.edit({
    name: novoNome.slice(0, 95),
    permissionOverwrites
  });
}

async function criarCanalFarm(guild, member, dados) {
  const nomeBase = limparNomeCanal(dados.nome || member.user.username || "membro");
  const passaporteBase = limparPassaporte(dados.passaporte || "sem-passaporte");

  const nomeCanal = `💸┃${nomeBase}┃${passaporteBase}`.slice(0, 95);

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  for (const cargoId of cargosLiberacao) {
    permissionOverwrites.push({
      id: cargoId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const canal = await guild.channels.create({
    name: nomeCanal,
    type: ChannelType.GuildText,
    parent: canais.categoriaFarmPrivado,
    topic: `farm:${member.id}`,
    permissionOverwrites
  });

  return canal;
}

function criarModalRegistro() {
  const modal = new ModalBuilder()
    .setCustomId(REGISTRO_MODAL_ID)
    .setTitle("Registro de novo membro");

  const nomeInput = new TextInputBuilder()
    .setCustomId("nome")
    .setLabel("Nome")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40);

  const passaporteInput = new TextInputBuilder()
    .setCustomId("passaporte")
    .setLabel("Passaporte")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  const numeroGameInput = new TextInputBuilder()
    .setCustomId("numero_game")
    .setLabel("Número em game")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(30);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nomeInput),
    new ActionRowBuilder().addComponents(passaporteInput),
    new ActionRowBuilder().addComponents(numeroGameInput)
  );

  return modal;
}

async function abrirModalRegistro(interaction) {
  const modal = criarModalRegistro();
  await interaction.showModal(modal);
}

async function enviarConfirmacaoNoCanalPrivado(canalFarm, member, dados, cargoAdicionado) {
  const linhas = [
    `✅ Registro concluído para ${member}.`,
    "",
    cargoAdicionado
      ? "✅ Cargo de membro adicionado."
      : "ℹ️ O usuário já possuía o cargo de membro.",
    "",
    `**Nome:** ${dados.nome}`,
    `**Passaporte:** ${dados.passaporte}`
  ];

  if (dados.numeroGame) {
    linhas.push(`**Número em game:** ${dados.numeroGame}`);
  }

  linhas.push("");
  linhas.push("Use este canal para sua organização de farm.");

  await canalFarm.send(linhas.join("\n"));
}

async function processarModalRegistro(interaction) {
  const nome = interaction.fields.getTextInputValue("nome").trim();
  const passaporte = interaction.fields.getTextInputValue("passaporte").trim();
  const numeroGame = interaction.fields.getTextInputValue("numero_game").trim();

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    return interaction.reply({
      content: "❌ Não foi possível localizar seu membro no servidor.",
      flags: 64
    });
  }

  const dados = {
    nome,
    passaporte,
    numeroGame
  };

  let cargoAdicionado = false;

  if (!member.roles.cache.has(cargoMembroPadrao)) {
    await member.roles.add(cargoMembroPadrao, "Registro automático de novo membro");
    cargoAdicionado = true;
  }

  if (member.roles.cache.has(cargoAmigos)) {
    await member.roles.remove(cargoAmigos).catch(() => null);
  }

  let canalFarm = await buscarCanalFarmExistente(interaction.guild, member.id);

  if (!canalFarm) {
    canalFarm = await criarCanalFarm(interaction.guild, member, dados);
  } else {
    await restaurarCanalSeExistir(canalFarm, member);
  }

  await enviarConfirmacaoNoCanalPrivado(canalFarm, member, dados, cargoAdicionado);

  return interaction.reply({
    content: `✅ Registro concluído. Seu canal privado é ${canalFarm}.`,
    flags: 64
  });
}

module.exports = {
  REGISTRO_BUTTON_ID,
  REGISTRO_MODAL_ID,
  abrirModalRegistro,
  criarPainelRegistro,
  processarModalRegistro
};