const { cargos } = require("../config/config");

function extrairRoleIds(...valores) {
  const itens = valores.flatMap((valor) => {
    if (Array.isArray(valor)) return valor;
    return [valor];
  });

  return [...new Set(
    itens
      .map((item) => {
        if (!item) return null;

        if (typeof item === "string") {
          return item.trim();
        }

        if (typeof item === "object") {
          if (typeof item.id === "string") return item.id.trim();
          if (typeof item.roleId === "string") return item.roleId.trim();
          if (typeof item.value === "string") return item.value.trim();
        }

        return null;
      })
      .filter((item) => item && /^\d+$/.test(item))
  )];
}

function memberTemAlgumCargo(member, roleIds) {
  if (!member || !member.roles || !member.roles.cache) return false;
  if (!Array.isArray(roleIds) || !roleIds.length) return false;

  return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

function getCargosLiderancaIds() {
  return extrairRoleIds(
    cargos.cargo01,
    cargos.cargo02,
    cargos.cargo03,
    cargos.cargoGerenteGeral,
    cargos.gerenteGeral,
    cargos.lideranca
  );
}

function getCargosControleBauIds() {
  return extrairRoleIds(
    cargos.cargo01,
    cargos.cargo02,
    cargos.cargo03,
    cargos.cargoGerenteGeral,
    cargos.cargoMembro,
    cargos.membro
  );
}

function getCargosRegistroIds() {
  return extrairRoleIds(
    cargos.cargo01,
    cargos.cargo02,
    cargos.cargo03,
    cargos.cargoGerenteGeral,
    cargos.cargoMembro,
    cargos.membro
  );
}

function isGerenteOuLider(member) {
  return memberTemAlgumCargo(member, getCargosLiderancaIds());
}

function podeUsarBauGerencia(member) {
  return memberTemAlgumCargo(member, getCargosLiderancaIds());
}

function podeUsarControleBau(member) {
  return memberTemAlgumCargo(member, getCargosControleBauIds());
}

function podeUsarRegistro(member) {
  return memberTemAlgumCargo(member, getCargosRegistroIds());
}

function podeUsarFarm(member, channel = null) {
  if (!member) return false;

  if (isGerenteOuLider(member)) {
    return true;
  }

  if (!channel) return false;

  const topic = String(channel.topic || "").trim();
  const esperado = `farm:${member.id}`;

  return topic === esperado;
}

module.exports = {
  extrairRoleIds,
  memberTemAlgumCargo,
  getCargosLiderancaIds,
  getCargosControleBauIds,
  getCargosRegistroIds,
  isGerenteOuLider,
  podeUsarBauGerencia,
  podeUsarControleBau,
  podeUsarRegistro,
  podeUsarFarm
};