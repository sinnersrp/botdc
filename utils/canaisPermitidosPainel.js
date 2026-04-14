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
      canais.canalDinheiroSujo,
      canais.metaSemanal
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

function getPainelCategoryMap() {
  return {
    farm: unique([
      canais.categoriaFarm,
      canais.categoriaFarmPrivado
    ]),
    bau: unique([
      canais.categoriaBau,
      canais.categoriaGerencia
    ]),
    controle_bau: unique([
      canais.categoriaControleBau
    ]),
    registro: unique([
      canais.categoriaRegistro
    ]),
    avisos: unique([
      canais.categoriaAvisos
    ]),
    gerencia: unique([
      canais.categoriaGerencia
    ])
  };
}

function canUsePainelHere(tipo, channel) {
  if (!channel) return false;

  const mapa = getPainelMap();
  const categorias = getPainelCategoryMap();

  const permitidos = mapa[tipo] || [];
  const categoriasPermitidas = categorias[tipo] || [];

  const channelId = String(channel.id);
  const parentId = channel.parentId ? String(channel.parentId) : null;

  if (permitidos.includes(channelId)) return true;
  if (parentId && categoriasPermitidas.includes(parentId)) return true;

  return false;
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