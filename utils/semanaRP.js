function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSemanaRP(baseDate = new Date()) {
  const now = new Date(baseDate);

  const ano = now.getFullYear();
  const mes = now.getMonth();
  const dia = now.getDate();
  const hora = now.getHours();
  const minuto = now.getMinutes();

  const atual = new Date(ano, mes, dia, hora, minuto, 0, 0);

  // 0 = domingo, 1 = segunda ... 5 = sexta, 6 = sábado
  const weekday = atual.getDay();

  // Queremos semana de SEXTA até a próxima SEXTA
  // Exemplo:
  // 10/04 22:00 até 17/04 21:59
  // Para identificação, usamos 10/04_17/04

  let inicio = new Date(atual);
  let diasDesdeSexta = (weekday - 5 + 7) % 7;

  inicio.setDate(atual.getDate() - diasDesdeSexta);
  inicio.setHours(22, 0, 0, 0);

  // Se for sexta antes das 22:00, ainda está na semana anterior
  if (weekday === 5 && (hora < 22 || (hora === 22 && minuto === 0 ? false : false))) {
    if (hora < 22) {
      inicio.setDate(inicio.getDate() - 7);
    }
  }

  // fim = próxima sexta às 21:59:59.999
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 7);
  fim.setHours(21, 59, 59, 999);

  const semanaId = `${formatDate(inicio)}_${formatDate(fim)}`;

  return {
    inicio,
    fim,
    semanaId
  };
}

module.exports = getSemanaRP;