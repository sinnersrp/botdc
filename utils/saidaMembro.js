const { PermissionFlagsBits } = require("discord.js");
const { cargoMembroPadrao, cargoAmigos, cargosLiberacao } = require("../config/config");

function normalizarNome(nome = "") {
  return nome
    .replace(/^💸┃/, "")
    .replace(/^arquivado-/, "")
    .trim();
}

async function arquivarCanalMembro(member, canalFarm) {
  const permissionOverwrites = [
    {
      id: member.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
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

  permissionOverwrites.push({
    id: member.id,
    deny: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages
    ]
  });

  const nomeAtual = normalizarNome(canalFarm.name);
  const novoNome = `arquivado-${nomeAtual}`.slice(0, 95);

  await canalFarm.edit({
    name: novoNome,
    permissionOverwrites
  });

  await canalFarm.send(`📦 Canal arquivado. ${member.user.username} saiu da facção, mas os dados foram preservados.`);
}

async function restaurarCanalMembro(member, canalFarm) {
  const permissionOverwrites = [...canalFarm.permissionOverwrites.cache.values()]
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

  let novoNome = canalFarm.name;
  if (novoNome.startsWith("arquivado-")) {
    novoNome = novoNome.replace(/^arquivado-/, "");
  }

  await canalFarm.edit({
    name: novoNome.slice(0, 95),
    permissionOverwrites
  });

  await canalFarm.send(`✅ Canal restaurado para ${member}.`);
}

async function processarSaidaOuRetorno(oldMember, newMember) {
  const tinhaMembro = oldMember.roles.cache.has(cargoMembroPadrao);
  const temMembro = newMember.roles.cache.has(cargoMembroPadrao);

  const canalFarm = newMember.guild.channels.cache.find(
    (channel) => channel.topic === `farm:${newMember.id}`
  );

  if (!canalFarm) return;

  if (tinhaMembro && !temMembro) {
    if (!newMember.roles.cache.has(cargoAmigos)) {
      await newMember.roles.add(cargoAmigos, "Saiu da facção, movido para amigos");
    }

    await arquivarCanalMembro(newMember, canalFarm);
    return;
  }

  if (!tinhaMembro && temMembro) {
    if (newMember.roles.cache.has(cargoAmigos)) {
      await newMember.roles.remove(cargoAmigos).catch(() => null);
    }

    await restaurarCanalMembro(newMember, canalFarm);
  }
}

module.exports = {
  processarSaidaOuRetorno
};