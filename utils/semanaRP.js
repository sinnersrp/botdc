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

  // 0 = domingo ... 6 = sábado
  const weekday = atual.getDay();

  // Semana do farm:
  // começa no sábado às 22:00
  // termina no próximo sábado às 21:59:59.999
  //
  // Exemplo:
  // 11/04 22:00 até 18/04 21:59
  // semanaId = 2026-04-11_2026-04-18

  let inicio = new Date(atual);

  // Quantos dias se passaram desde o último sábado
  const diasDesdeSabado = (weekday - 6 + 7) % 7;

  inicio.setDate(atual.getDate() - diasDesdeSabado);
  inicio.setHours(22, 0, 0, 0);

  // Se hoje é sábado antes das 22:00, ainda estamos na semana anterior
  if (weekday === 6 && hora < 22) {
    inicio.setDate(inicio.getDate() - 7);
  }

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