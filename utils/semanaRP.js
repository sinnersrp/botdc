function getSemanaRP(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();

  const inicio = new Date(current);
  const diffToFriday = (day + 2) % 7;
  inicio.setDate(current.getDate() - diffToFriday);
  inicio.setHours(22, 0, 0, 0);

  if (current < inicio) {
    inicio.setDate(inicio.getDate() - 7);
  }

  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 7);
  fim.setHours(22, 0, 0, 0);

  const fimExibicao = new Date(fim.getTime() - 1000);

  const semanaId = `${inicio.toISOString().slice(0, 10)}_${fim
    .toISOString()
    .slice(0, 10)}`;

  return {
    inicio,
    fim,
    fimExibicao,
    semanaId
  };
}

module.exports = getSemanaRP;
