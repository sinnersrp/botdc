const FarmRegistro = require("../models/FarmRegistro");
const CaixaFaccao = require("../models/CaixaFaccao");
const MovimentacaoCaixa = require("../models/MovimentacaoCaixa");

async function getOuCriarCaixaFaccao() {
  let caixa = await CaixaFaccao.findOne({ key: "caixa_principal" });

  if (!caixa) {
    caixa = await CaixaFaccao.create({
      key: "caixa_principal"
    });
  }

  return caixa;
}

async function calcularTotaisFinanceiros() {
  const registrosFarm = await FarmRegistro.find({});
  const movimentacoes = await MovimentacaoCaixa.find({});

  const dinheiroSujoTotal = registrosFarm.reduce(
    (acc, item) => acc + (Number(item.valor) || 0),
    0
  );

  let totalLavado = 0;
  let caixaTotal = 0;

  for (const mov of movimentacoes) {
    const valor = Number(mov.valor) || 0;

    if (mov.tipo === "lavagem") {
      totalLavado += valor;
      caixaTotal += valor;
    }

    if (mov.tipo === "ajuste_entrada") {
      caixaTotal += valor;
    }

    if (mov.tipo === "ajuste_saida") {
      caixaTotal -= valor;
    }
  }

  const dinheiroSujoDisponivel = dinheiroSujoTotal - totalLavado;
  const dinheiroLimpoTotal = totalLavado;

  return {
    dinheiroSujoTotal,
    dinheiroSujoDisponivel,
    dinheiroLimpoTotal,
    totalLavado,
    caixaTotal
  };
}

async function sincronizarCaixaFaccao() {
  const caixa = await getOuCriarCaixaFaccao();
  const totais = await calcularTotaisFinanceiros();

  caixa.dinheiroSujoTotal = totais.dinheiroSujoTotal;
  caixa.dinheiroSujoDisponivel = totais.dinheiroSujoDisponivel;
  caixa.dinheiroLimpoTotal = totais.dinheiroLimpoTotal;
  caixa.totalLavado = totais.totalLavado;
  caixa.caixaTotal = totais.caixaTotal;
  caixa.ultimaSincronizacao = new Date();

  await caixa.save();

  return caixa;
}

module.exports = {
  sincronizarPlanilhaFarm
};