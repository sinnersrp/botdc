const { canais } = require("../config/config");

function unique(ids) {
  return [...new Set(ids.filter(Boolean).map(String))];
}

function getForumChannelIds() {
  return unique([
    canais.forumComandoBot,
    canais.comandoBotForum,
    canais.comandoBot,
    "1492991343948070922"
  ]);
}

function getPainelMap() {
  return {
    farm: unique([
      ...getForumChannelIds(),
      canais.farm,
      canais.canalFarm,
      canais.dinheiroSujo,
      canais.canalDinheiroSujo
    ]),
    bau: unique([
      ...getForumChannelIds(),
      canais.bauGerencia,
      canais.canalBauGerencia
    ]),
    controle_bau: unique([
      ...getForumChannelIds(),
      canais.controleBau,
      canais.canalControleBau
    ]),
    registro: unique([
      ...getForumChannelIds(),
      canais.registro,
      canais.canalRegistro
    ]),
    avisos: unique([
      ...getForumChannelIds(),
      canais.avisos,
      canais.canalAvisos,
      "1480507565770018851"
    ]),
    gerencia: unique([
      ...getForumChannelIds(),
      canais.gerencia,
      canais.canalGerencia
    ])
  };
}

function canUsePainelHere(tipo, channelId) {
  const mapa = getPainelMap();
  const permitidos = mapa[tipo] || [];
  return permitidos.includes(String(channelId));
}

function getAllowedChannelMentions(tipo) {
  const mapa = getPainelMap();
  const permitidos = mapa[tipo] || [];
  return permitidos.map((id) => `<#${id}>`).join(", ");
}

module.exports = {
  canUsePainelHere,
  getAllowedChannelMentions
};