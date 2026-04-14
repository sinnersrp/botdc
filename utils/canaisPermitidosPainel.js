const { canais } = require("../config/config");

function normalizeName(name = "") {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function sameName(channel, expected) {
  return normalizeName(channel?.name) === normalizeName(expected);
}

function isInCategory(channel, categoryIds = []) {
  if (!channel?.parentId) return false;
  return categoryIds.map(String).includes(String(channel.parentId));
}

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

  const categoriaFarm = ["1480507566302691412"];
  const categoriaControleBau = ["1480507568265760812", "1480507568265760814"];
  const categoriaBauGerencia = ["1486811209565995169", "1486811278281408512"];

  switch (tipo) {
    case "registro":
      return String(channel.id) === "1480507565770018849";

    case "avisos":
      return String(channel.id) === "1480507565770018851";

    case "farm":
      if (String(channel.id) === "1480507566302691413") return true; // meta-semanal
      return isInCategory(channel, categoriaFarm);

    case "bau":
      return (
        isInCategory(channel, categoriaBauGerencia) &&
        (sameName(channel, "entrada-bau") || sameName(channel, "saida-bau"))
      );

    case "controle_bau":
      return (
        isInCategory(channel, categoriaControleBau) &&
        (sameName(channel, "entrada") || sameName(channel, "saida"))
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
      return "fórum comando-bot ou canais entrada-bau / saida-bau do baú gerência";
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