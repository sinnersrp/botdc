const { canais } = require("../config/config");

function isForum(channel) {
  const forumIds = [
    canais.forumComandoBot,
    canais.comandoBot,
    canais.comandoBotForum,
    "1492991343948070922"
  ]
    .filter(Boolean)
    .map(String);

  return forumIds.includes(String(channel?.id));
}

function canUsePainelHere(tipo, channel) {
  if (!channel) return false;

  if (isForum(channel)) return true;

  const channelId = String(channel.id);
  const parentId = channel.parentId ? String(channel.parentId) : "";

  switch (tipo) {
    case "registro":
      return channelId === "1480507565770018849";

    case "avisos":
      return channelId === "1480507565770018851";

    case "farm":
      return (
        channelId === "1480507566302691413" || // meta-semanal
        parentId === "1480507566302691412"     // canais da área farm
      );

    case "bau":
      return (
        channelId === "1486811209565995169" || // entrada-bau
        channelId === "1486811278281408512"    // saida-bau
      );

    case "controle_bau":
      return (
        channelId === "1480507568265760812" || // entrada
        channelId === "1480507568265760814"    // saida
      );

    default:
      return false;
  }
}

function getAllowedText(tipo) {
  switch (tipo) {
    case "registro":
      return "fórum comando-bot ou canal registro";
    case "avisos":
      return "fórum comando-bot ou canal de avisos";
    case "farm":
      return "fórum comando-bot, meta-semanal ou canais da área FARM";
    case "bau":
      return "fórum comando-bot ou canais entrada-bau / saida-bau";
    case "controle_bau":
      return "fórum comando-bot ou canais entrada / saida do controle de baú";
    default:
      return "canal permitido";
  }
}

module.exports = {
  canUsePainelHere,
  getAllowedText
};