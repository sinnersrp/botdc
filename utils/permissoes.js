const { cargos } = require("../config/config");

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getRoleIds(member) {
  if (!member?.roles?.cache) return [];
  return [...member.roles.cache.keys()].map(String);
}

function hasAnyRole(member, roleIds) {
  const memberRoles = getRoleIds(member);
  const allowed = toArray(roleIds);

  if (!memberRoles.length || !allowed.length) return false;
  return allowed.some((roleId) => memberRoles.includes(String(roleId)));
}

function getCargosAltos() {
  return [
    cargos.cargo01,
    cargos.cargo02,
    cargos.cargo03,
    cargos.gerenteGeral
  ];
}

function getTodosOsCargos() {
  return [
    cargos.cargo01,
    cargos.cargo02,
    cargos.cargo03,
    cargos.gerenteGeral,
    cargos.membro
  ];
}

function isGerenteOuLider(member) {
  return hasAnyRole(member, getCargosAltos());
}

function isMembro(member) {
  return hasAnyRole(member, getTodosOsCargos());
}

function podeUsarRegistro(member) {
  return hasAnyRole(member, getTodosOsCargos());
}

function podeUsarControleBau(member) {
  return hasAnyRole(member, getTodosOsCargos());
}

function podeUsarBauGerencia(member) {
  return hasAnyRole(member, getCargosAltos());
}

function getFarmOwnerId(channel) {
  if (!channel) return null;

  if (channel.topic && String(channel.topic).startsWith("farm:")) {
    return String(channel.topic).replace("farm:", "").trim();
  }

  return null;
}

function podeUsarFarmNoCanal(member, channel) {
  if (!member || !channel) return false;

  if (hasAnyRole(member, getCargosAltos())) {
    return true;
  }

  const ownerId = getFarmOwnerId(channel);
  if (!ownerId) return false;

  return String(member.id) === String(ownerId);
}

module.exports = {
  toArray,
  getRoleIds,
  hasAnyRole,
  isGerenteOuLider,
  isMembro,
  podeUsarRegistro,
  podeUsarControleBau,
  podeUsarBauGerencia,
  podeUsarFarmNoCanal,
  getFarmOwnerId
};