
const { EmbedBuilder } = require("discord.js");
const { canais } = require("../config/config");

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function getLogsChannelId() {
  return (
    canais.logs ||
    canais.categoriaLogs ||
    ""
  );
}

async function enviarLogBonito(client, payload = {}) {
  try {
    const channelId = getLogsChannelId();
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(payload.color || 0x5865f2)
      .setTitle(payload.title || "Log do sistema")
      .setDescription(payload.description || "Movimentação registrada.")
      .setFooter({
        text: payload.footer || "SINNERS BOT • Logs"
      })
      .setTimestamp();

    if (Array.isArray(payload.fields) && payload.fields.length) {
      embed.addFields(payload.fields);
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao enviar log bonito:", error);
  }
}

function criarCampo(name, value, inline = true) {
  return {
    name,
    value: value ? String(value) : "—",
    inline
  };
}

module.exports = {
  enviarLogBonito,
  criarCampo,
  formatNumber
};