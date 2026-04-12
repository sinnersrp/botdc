const { EmbedBuilder } = require("discord.js");
const { cargoMembroPadrao } = require("../config/config");

function criarEmbedAvisoPrivado({ mensagem, rodape = "SINNERS FAMILY • Aviso privado" }) {
  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📢 Aviso da Família")
    .setDescription(mensagem)
    .setFooter({ text: rodape })
    .setTimestamp();
}

async function buscarAlvosDM(guild, mencaoTipo) {
  await guild.members.fetch().catch(() => null);

  const membros = guild.members.cache.filter(
    (member) => !member.user.bot
  );

  if (mencaoTipo === "everyone") {
    return [...membros.values()];
  }

  if (mencaoTipo === "membro") {
    return [...membros.filter((member) => member.roles.cache.has(cargoMembroPadrao)).values()];
  }

  return [...membros.filter((member) => member.roles.cache.has(cargoMembroPadrao)).values()];
}

async function enviarAvisoPrivadoParaAlvos(guild, mensagem, mencaoTipo) {
  const alvos = await buscarAlvosDM(guild, mencaoTipo);

  let enviados = 0;
  let falhas = 0;

  for (const member of alvos) {
    try {
      await member.send({
        embeds: [
          criarEmbedAvisoPrivado({
            mensagem,
            rodape: "SINNERS FAMILY • Aviso enviado pela gerência"
          })
        ]
      });
      enviados += 1;
    } catch (error) {
      falhas += 1;
    }
  }

  return {
    total: alvos.length,
    enviados,
    falhas
  };
}

module.exports = {
  criarEmbedAvisoPrivado,
  enviarAvisoPrivadoParaAlvos
};