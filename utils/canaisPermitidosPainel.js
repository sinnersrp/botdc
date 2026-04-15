const { canais } = require("../config/config");

function toStr(value) {
  return value ? String(value) : "";
}

function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getForumIds() {
  return [
    canais.forumComandoBot,
    canais.comandoBot,
    canais.comandoBotForum,
    "1492991343948070922"
  ]
    .filter(Boolean)
    .map(String);
}

function isForumComandoBot(channel) {
  if (!channel) return false;

  const channelId = toStr(channel.id);
  const parentId = toStr(channel.parentId);
  const forumIds = getForumIds();

  return forumIds.includes(channelId) || forumIds.includes(parentId);
}

function channelNameIs(channel, ...nomes) {
  const nomeCanal = normalizarTexto(channel?.name || "");
  return nomes.map(normalizarTexto).includes(nomeCanal);
}

function canUsePainelHere(tipo, channel) {
  if (!channel) return false;

  if (isForumComandoBot(channel)) return true;

  const channelId = toStr(channel.id);

  switch (tipo) {
    case "registro":
      return (
        channelId === toStr(canais.registro) ||
        channelNameIs(channel, "registro")
      );

    case "avisos":
      return (
        channelId === toStr(canais.canalAvisos || canais.categoriaAvisos) ||
        channelNameIs(channel, "avisos", "canal-de-avisos", "aviso", "avisos-gerais")
      );

    case "farm":
      return (
        channelId === toStr(canais.metaSemanal) ||
        toStr(channel.parentId) === toStr(canais.categoriaFarm) ||
        channelNameIs(channel, "meta-semanal")
      );

    case "bau":
      return (
        channelId === toStr(canais.bauGerenciaEntrada) ||
        channelId === toStr(canais.bauGerenciaSaida) ||
        channelNameIs(channel, "entrada-bau", "saida-bau")
      );

    case "controle_bau":
      return (
        channelId === toStr(canais.controleBauEntrada) ||
        channelId === toStr(canais.controleBauSaida) ||
        channelNameIs(channel, "entrada", "saida")
      );

    case "gerencia":
      return (
        channelId === toStr(canais.chatGerencia) ||
        channelId === toStr(canais.logs) ||
        channelNameIs(channel, "chat-da-gerencia", "logs", "contatos")
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
    case "gerencia":
      return "fórum comando-bot ou canais de gerência, como chat-da-gerencia e logs";
    default:
      return "canal permitido";
  }
}

module.exports = {
  isForumComandoBot,
  canUsePainelHere,
  getAllowedText
};