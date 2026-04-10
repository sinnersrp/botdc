function getSemanaRP(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay(); // 0=dom, 5=sex
  const hour = current.getHours();

  const inicio = new Date(current);
  const diffToFriday = (day - 5 + 7) % 7;
  inicio.setDate(current.getDate() - diffToFriday);
  inicio.setHours(22, 0, 0, 0);

  // Se ainda não chegou sexta 22h da semana atual,
  // então a semana válida começou na sexta anterior 22h
  if (day < 5 || (day === 5 && hour < 22)) {
    inicio.setDate(inicio.getDate() - 7);
  }

  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);
  fim.setSeconds(fim.getSeconds() - 1); // sexta 21:59:59

  const semanaId = `${inicio.toISOString().slice(0, 10)}_${fim
    .toISOString()
    .slice(0, 10)}`;

  return {
    inicio,
    fim,
    semanaId
  };
}

module.exports = getSemanaRP;
