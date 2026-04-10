const META_SEMANAL = 100000;

function calcularMetaSemanal(total = 0) {
  const valorTotal = Number(total) || 0;
  const valorFamilia = Math.min(valorTotal, META_SEMANAL);
  const excedente = Math.max(valorTotal - META_SEMANAL, 0);
  const valorLimpo = Math.floor(excedente * 0.5);
  const faltante = Math.max(META_SEMANAL - valorTotal, 0);

  return {
    metaSemanal: META_SEMANAL,
    valorTotal,
    valorFamilia,
    excedente,
    valorLimpo,
    faltante,
    bateuMeta: valorTotal >= META_SEMANAL
  };
}

function formatMoney(value) {
  return `R$ ${new Intl.NumberFormat("pt-BR").format(Number(value) || 0)}`;
}

function formatDateBR(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

module.exports = {
  META_SEMANAL,
  calcularMetaSemanal,
  formatMoney,
  formatDateBR
};
