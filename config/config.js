const cargos = {
  gerenteGeral: process.env.CARGO_GERENTE_GERAL || "",
  gerenteFarm: process.env.CARGO_GERENTE_FARM || "",
  gerenteBau: process.env.CARGO_GERENTE_BAU || "",
  gerenteAcao: process.env.CARGO_GERENTE_ACAO || "",
  lider: process.env.CARGO_LIDER || "",
  membro: process.env.CARGO_MEMBRO || "",
  developer: process.env.CARGO_DEVELOPER || ""
};

const canais = {
  forumComandoBot: "1492991343948070922",
  comandoBot: "1492991343948070922",
  comandoBotForum: "1492991343948070922",

  categoriaBot: "1492979624278364230",

  farm: "1480507566302691413",
  canalFarm: "1480507566302691413",
  dinheiroSujo: "1480507566302691413",
  canalDinheiroSujo: "1480507566302691413",
  metaSemanal: "1480507566302691413",

  categoriaFarm: "1480507566302691412",
  categoriaFarmPrivado: "1480507566302691412",

  controleBau: "",
  canalControleBau: "",
  categoriaControleBau: "1480507568265760812",

  categoriaControleBauExtra: "1480507568265760814",

  registro: "1480507565770018849",
  canalRegistro: "1480507565770018849",
  canalRegistroDiscord: "1480507565770018849",
  categoriaRegistro: "1480507565770018849",

  avisos: "1480507565770018851",
  canalAvisos: "1480507565770018851",
  categoriaAvisos: "1480507565770018851",

  bauGerencia: "",
  canalBauGerencia: "",
  categoriaBau: "1486811209565995169",
  categoriaGerencia: "1486811209565995169",
  categoriaGerenciaExtra: "1486811278281408512",

  comprovanteFarm: "1487959772870348870",
  categoriaComprovanteFarm: "1487959772870348870",

  logs: "1480507568265760809",
  categoriaLogs: "1480507568265760809"
};

const itensGerais = [
  "maconha",
  "metafetamina",
  "cocaina",
  "chip ilegal",
  "lockpick",
  "hacking",
  "attachs",
  "colete",
  "algema",
  "capuz",
  "envelope",
  "adrenalina",
  "bandagem"
];

const itensArmas = [
  "sub",
  "fiveseven",
  "hhk",
  "mp5",
  "g36",
  "c4",
  "muni pt",
  "muni sub",
  "muni de refle"
];

module.exports = {
  cargos,
  canais,
  itensGerais,
  itensArmas
};