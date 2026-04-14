function normalizarIds(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.map(String).filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [String(input)].filter(Boolean);
}

function getMemberRoleIds(member) {
  if (!member || !member.roles || !member.roles.cache) return [];
  return [...member.roles.cache.keys()].map(String);
}

function membroTemAlgumCargo(member, cargosPermitidos) {
  const memberRoleIds = getMemberRoleIds(member);
  const permitidos = normalizarIds(cargosPermitidos);

  if (!memberRoleIds.length || !permitidos.length) return false;

  return permitidos.some((cargoId) => memberRoleIds.includes(String(cargoId)));
}

function isGerenteOuLider(member) {
  try {
    const { cargos } = require("../config/config");

    const cargosGerencia = normalizarIds([
      ...(normalizarIds(cargos?.gerenteGeral)),
      ...(normalizarIds(cargos?.gerenteFarm)),
      ...(normalizarIds(cargos?.gerenteBau)),
      ...(normalizarIds(cargos?.gerenteAcao)),
      ...(normalizarIds(cargos?.lider)),
      ...(normalizarIds(cargos?.developer))
    ]);

    return membroTemAlgumCargo(member, cargosGerencia);
  } catch (error) {
    console.error("Erro em isGerenteOuLider:", error);
    return false;
  }
}

function isMembro(member) {
  try {
    const { cargos } = require("../config/config");

    const cargosMembro = normalizarIds([
      ...(normalizarIds(cargos?.membro)),
      ...(normalizarIds(cargos?.gerenteGeral)),
      ...(normalizarIds(cargos?.gerenteFarm)),
      ...(normalizarIds(cargos?.gerenteBau)),
      ...(normalizarIds(cargos?.gerenteAcao)),
      ...(normalizarIds(cargos?.lider)),
      ...(normalizarIds(cargos?.developer))
    ]);

    return membroTemAlgumCargo(member, cargosMembro);
  } catch (error) {
    console.error("Erro em isMembro:", error);
    return false;
  }
}

module.exports = {
  normalizarIds,
  membroTemAlgumCargo,
  isGerenteOuLider,
  isMembro
};