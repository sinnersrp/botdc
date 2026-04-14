const FarmRegistro = require("../models/FarmRegistro");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const MovimentacaoCaixa = require("../models/MovimentacaoCaixa");
const { sincronizarCaixaFaccao } = require("../utils/financeiroFaccao");
const { enviarLogBonito, criarCampo, formatNumber } = require("../utils/logMovimentacaoBonita");
const { canais } = require("../config/config");

function inicioDoDia() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

function fimDoDia() {
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  return hoje;
}

async function enviarResumoDiario(client) {
  try {
    const inicio = inicioDoDia();
    const fim = fimDoDia();

    const movs = await MovimentacaoBau.find({
      registradoEm: { $gte: inicio, $lte: fim }
    });

    const farms = await FarmRegistro.find({
      registradoEm: { $gte: inicio, $lte: fim }
    });

    const caixaMovs = await MovimentacaoCaixa.find({
      registradoEm: { $gte: inicio, $lte: fim }
    });

    let entradaGerencia = 0;
    let saidaGerencia = 0;
    let transferidoControle = 0;
    let liberadoControle = 0;
    let retiradoControle = 0;
    let devolvidoControle = 0;

    for (const mov of movs) {
      const item = String(mov.item || "");
      const tipo = String(mov.tipoMovimentacao || "");
      const quantidade = Number(mov.quantidade) || 0;

      const ehGerencia = item.startsWith("gerencia_");

      if (ehGerencia && tipo === "entrada") entradaGerencia += quantidade;
      if (ehGerencia && tipo === "saida") saidaGerencia += quantidade;
      if (ehGerencia && tipo === "transferencia_controle") transferidoControle += quantidade;

      if (!ehGerencia && tipo === "liberar") liberadoControle += quantidade;
      if (!ehGerencia && tipo === "retirar") retiradoControle += quantidade;
      if (!ehGerencia && tipo === "devolver") devolvidoControle += quantidade;
    }

    const dinheiroSujoDia = farms.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

    let lavadoDia = 0;
    for (const mov of caixaMovs) {
      if (mov.tipo === "lavagem") {
        lavadoDia += Number(mov.valor) || 0;
      }
    }

    const caixa = await sincronizarCaixaFaccao();

    await enviarLogBonito(client, {
      color: 0x8e44ad,
      title: "📊 Resumo diário da facção",
      description: "Resumo automático das movimentações de hoje.",
      fields: [
        criarCampo("📥 Entrada baú gerência", `**${formatNumber(entradaGerencia)}**`),
        criarCampo("📤 Saída baú gerência", `**${formatNumber(saidaGerencia)}**`),
        criarCampo("🔄 Transferido p/ controle", `**${formatNumber(transferidoControle)}**`),
        criarCampo("✅ Liberado no controle", `**${formatNumber(liberadoControle)}**`),
        criarCampo("📤 Retirado do controle", `**${formatNumber(retiradoControle)}**`),
        criarCampo("📥 Devolvido ao controle", `**${formatNumber(devolvidoControle)}**`),
        criarCampo("💸 Dinheiro sujo do dia", `**R$ ${formatNumber(dinheiroSujoDia)}**`),
        criarCampo("🧼 Lavado no dia", `**R$ ${formatNumber(lavadoDia)}**`),
        criarCampo("🏦 Caixa atual", `**R$ ${formatNumber(caixa.caixaTotal)}**`),
        criarCampo("💰 Sujo disponível", `**R$ ${formatNumber(caixa.dinheiroSujoDisponivel)}**`)
      ],
      footer: "SINNERS BOT • Resumo diário"
    });
  } catch (error) {
    console.error("Erro ao enviar resumo diário:", error);
  }
}

function iniciarResumoDiarioScheduler(client) {
  let ultimaDataExecutada = "";

  setInterval(async () => {
    try {
      const agora = new Date();
      const dataHoje = agora.toLocaleDateString("pt-BR");

      if (agora.getHours() === 22 && agora.getMinutes() === 0) {
        if (ultimaDataExecutada !== dataHoje) {
          ultimaDataExecutada = dataHoje;
          await enviarResumoDiario(client);
        }
      }
    } catch (error) {
      console.error("Erro no scheduler de resumo diário:", error);
    }
  }, 60 * 1000);
}

module.exports = {
  iniciarResumoDiarioScheduler,
  enviarResumoDiario
};