const {
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const {
  canais,
  cargosLiberacao,
  cargoMembroPadrao
} = require("../config/config");

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

function extrairCampo(regex, texto) {
  const match = texto.match(regex);
  return match ? match[1].trim() : null;
}

function extrairDadosRegistro(conteudo) {
  const nome = extrairCampo(/nome\s*:\s*(.+)/i, conteudo);
  const passaporte = extrairCampo(/passaporte\s*:\s*(.+)/i, conteudo);
  const numeroGame = extrairCampo(/numero\s*em\s*game\s*:\s*(.+)/i, conteudo);

  if (!nome || !passaporte) {
    return null;
  }

  return {
    nome,
    passaporte,
    numeroGame: numeroGame || ""
  };
}

async function buscarCanalFarmExistente(guild, userId) {
  return guild.channels.cache.find((channel) => {
    if (channel.parentId !== canais.categoriaFarmPrivado) return false;
    return channel.topic === `farm:${userId}`;
  }) || null;
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

  const linhas = [
    `✅ Canal de farm criado para ${member}.`,
    "",
    `**Nome:** ${dados.nome}`,
    `**Passaporte:** ${dados.passaporte}`
  ];

  if (dados.numeroGame) {
    linhas.push(`**Número em game:** ${dados.numeroGame}`);
  }

  linhas.push("");
  linhas.push("Use este canal para sua organização de farm.");

  await canal.send(linhas.join("\n"));

  return canal;
}

async function enviarConfirmacaoPrivada(member, dados, cargoAdicionado, canalFarm) {
  const linhas = [];

  linhas.push("✅ Seu registro foi processado com sucesso.");

  if (cargoAdicionado) {
    linhas.push(`✅ Cargo de membro adicionado.`);
  } else {
    linhas.push(`ℹ️ Você já possuía o cargo de membro.`);
  }

  if (canalFarm) {
    linhas.push(`✅ Canal de farm criado: ${canalFarm}`);
  }

  linhas.push("");
  linhas.push(`**Nome:** ${dados.nome}`);
  linesafe: if (dados.passaporte) {
    linhas.push(`**Passaporte:** ${dados.passaporte}`);
  }
  if (dados.numeroGame) {
    linhas.push(`**Número em game:** ${dados.numeroGame}`);
  }

  try {
    await member.send(linhas.join("\n"));
  } catch (error) {
    console.log(`Não foi possível enviar DM para ${member.user.tag}.`);
  }
}

async function processarRegistro(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.channel.id !== canais.registro) return;

    const dados = extrairDadosRegistro(message.content);
    if (!dados) return;

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    let cargoAdicionado = false;
    if (!member.roles.cache.has(cargoMembroPadrao)) {
      await member.roles.add(cargoMembroPadrao, "Registro automático de novo membro");
      cargoAdicionado = true;
    }

    let canalFarm = await buscarCanalFarmExistente(message.guild, member.id);

    if (!canalFarm) {
      canalFarm = await criarCanalFarm(message.guild, member, dados);
    }

    await enviarConfirmacaoPrivada(member, dados, cargoAdicionado, canalFarm);

    await message.react("✅").catch(() => null);
  } catch (error) {
    console.error("Erro ao processar registro de membro:", error);
    await message.react("❌").catch(() => null);
  }
}

module.exports = {
  processarRegistro
};