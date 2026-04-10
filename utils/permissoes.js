const { cargosLiberacao, cargosMembro } = require("../config/config");

function isGerenteOuLider(member) {
  return cargosLiberacao.some(cargoId => member.roles.cache.has(cargoId));
}

function isMembro(member) {
  return cargosMembro.some(cargoId => member.roles.cache.has(cargoId)) || isGerenteOuLider(member);
}

module.exports = {
  isGerenteOuLider,
  isMembro
};