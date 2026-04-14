const { canais } = require("../config/config");

function unique(ids) {
  return [...new Set(ids.filter(Boolean).map(String))];
}

function getForumChannelIds() {
  return unique([
    canais.forumComandoBot,
    canais.comandoBotForum,
    canais.comandoBot
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
      canais.canalRegistro,
      canais.canalRegistroDiscord
    ]),
    avisos: unique([
      ...getForumChannelIds(),
      canais.avisos,
      canais.canalAvisos
    ]),
    gerencia: unique([
      ...getForumChannelIds()
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
      canais.categoriaGerencia,
      canais.categoriaGerenciaExtra
    ]),
    controle_bau: unique([
      canais.categoriaControleBau,
      canais.categoriaControleBauExtra
    ]),
    registro: unique([
      canais.categoriaRegistro
    ]),
    avisos: unique([
      canais.categoriaAvisos
    ]),
    gerencia: unique([
      canais.categoriaGerencia,
      canais.categoriaGerenciaExtra
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