require("dotenv").config();
const mongoose = require("mongoose");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");

function normalizarTexto(valor = "") {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const MAPEAMENTO_ITENS = {
  // Drogas
  "coca": "cocaina",
  "cocaína": "cocaina",
  "cocaina": "cocaina",
  "maconha": "maconha",
  "metafetamina": "metanfetamina",
  "meta": "metanfetamina",
  "metanfetamina": "metanfetamina",

  // Armas
  "g36": "g36c mk2",
  "g36c": "g36c mk2",
  "g36c mk2": "g36c mk2",
  "mp5": "mp5",
  "fiveseven": "fn five seven",
  "five seven": "fn five seven",
  "fn five seven": "fn five seven",
  "m1911": "hhk",
  "hhk": "hhk",

  // Munições
  "muni pt": "municao pistola",
  "municao pt": "municao pistola",
  "munição pistola": "municao pistola",
  "municao pistola": "municao pistola",

  "muni sub": "municao submetralhadora",
  "municao sub": "municao submetralhadora",
  "munição submetralhadora": "municao submetralhadora",
  "municao submetralhadora": "municao submetralhadora",

  "muni fuzil": "municao rifle",
  "muni rifle": "municao rifle",
  "munição rifle": "municao rifle",
  "municao rifle": "municao rifle",

  // Itens de ação
  "c4": "explosivo c4",
  "explosivo c4": "explosivo c4",
  "hacking": "hacking",
  "furadeira": "furadeira",
  "lock": "lockpick",
  "lockpick": "lockpick",
  "envelope manchado": "envelope manchado",
  "chip ilegal": "chip ilegal",

  // Utilitários
  "algema": "algemas",
  "algemas": "algemas",
  "adrenalina": "adrenalina",
  "capuz": "capuz",
  "celular": "celular",
  "radio": "radio",
  "rádio": "radio",
  "chave": "chave",
  "galao": "galao",
  "galão": "galao",

  // Valores
  "farm": "dinheiro sujo",
  "dinheiro sujo": "dinheiro sujo"
};

const ITENS_ARMA = new Set([
  "g36c mk2",
  "mp5",
  "fn five seven",
  "hhk"
]);

const ACOES_VALIDAS = new Set([
  "entrada",
  "saida",
  "transferir",
  "transferencia_controle",
  "liberar",
  "retirar",
  "devolver"
]);

function mapearItemBase(item) {
  const normalizado = normalizarTexto(item);
  return MAPEAMENTO_ITENS[normalizado] || normalizado;
}

function mapearItemCompleto(itemOriginal) {
  const item = String(itemOriginal || "").trim();

  if (item.startsWith("gerencia_")) {
    const base = item.replace(/^gerencia_/i, "");
    return `gerencia_${mapearItemBase(base)}`;
  }

  return mapearItemBase(item);
}

function getTipoItem(item = "") {
  const base = String(item).replace(/^gerencia_/i, "");
  return ITENS_ARMA.has(base) ? "arma" : "geral";
}

function nomeBonito(item = "") {
  return String(item)
    .replace(/^gerencia_/i, "")
    .split(" ")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

function normalizarCargo(cargo, item = "") {
  const valor = normalizarTexto(cargo);

  if (valor === "gerencia" || valor === "gerente" || valor === "lider" || valor === "lideranca") {
    return "gerencia";
  }

  if (valor === "membro" || valor === "membros") {
    return "membro";
  }

  return String(item).startsWith("gerencia_") ? "gerencia" : "membro";
}

function normalizarTipo(tipo, item = "") {
  const valor = normalizarTexto(tipo);

  if (valor === "bau_gerencia" || valor === "bau gerencia" || valor === "gerencia") {
    return "bau_gerencia";
  }

  if (valor === "controle_bau" || valor === "controle bau" || valor === "controle") {
    return "controle_bau";
  }

  return String(item).startsWith("gerencia_") ? "bau_gerencia" : "controle_bau";
}

function normalizarAcao(acao, tipoMovimentacao, item = "") {
  const bruto = normalizarTexto(acao || tipoMovimentacao);

  const mapa = {
    "entrada": "entrada",
    "entrou": "entrada",
    "adicionar": "entrada",
    "adicionou": "entrada",

    "saida": "saida",
    "saiu": "saida",
    "remover": "saida",
    "removeu": "saida",

    "transferir": "transferir",
    "transferiu": "transferir",
    "transferencia": "transferencia_controle",
    "transferencia_controle": "transferencia_controle",

    "liberar": "liberar",
    "liberou": "liberar",

    "retirar": "retirar",
    "retirou": "retirar",

    "devolver": "devolver",
    "devolveu": "devolver"
  };

  const convertido = mapa[bruto];
  if (convertido && ACOES_VALIDAS.has(convertido)) {
    return convertido;
  }

  return String(item).startsWith("gerencia_") ? "entrada" : "retirar";
}

function normalizarTipoMovimentacao(tipoMovimentacao, acao, item = "") {
  const valor = normalizarAcao(tipoMovimentacao, acao, item);
  return ACOES_VALIDAS.has(valor) ? valor : (String(item).startsWith("gerencia_") ? "entrada" : "retirar");
}

async function migrarControleBau() {
  console.log("📦 Migrando coleção ControleBau...");

  const registros = await ControleBau.find({}).sort({ item: 1 });

  let atualizados = 0;
  let mesclados = 0;
  let semMudanca = 0;

  for (const registro of registros) {
    const itemAntigo = String(registro.item || "").trim();
    const itemNovo = mapearItemCompleto(itemAntigo);
    const tipoNovo = getTipoItem(itemNovo);

    if (itemAntigo === itemNovo && registro.tipo === tipoNovo) {
      semMudanca++;
      continue;
    }

    const existente = await ControleBau.findOne({
      _id: { $ne: registro._id },
      item: itemNovo
    });

    if (existente) {
      existente.quantidade = Number(existente.quantidade || 0) + Number(registro.quantidade || 0);
      existente.tipo = tipoNovo;
      await existente.save();
      await ControleBau.deleteOne({ _id: registro._id });

      mesclados++;
      console.log(`🔀 Mesclado: ${itemAntigo} -> ${itemNovo}`);
    } else {
      registro.item = itemNovo;
      registro.tipo = tipoNovo;
      await registro.save();

      atualizados++;
      console.log(`✅ Atualizado: ${itemAntigo} -> ${itemNovo}`);
    }
  }

  console.log(`📦 ControleBau concluído: ${atualizados} atualizados, ${mesclados} mesclados, ${semMudanca} sem mudança.`);
}

async function migrarMovimentacaoBau() {
  console.log("🧾 Migrando coleção MovimentacaoBau...");

  const registros = await MovimentacaoBau.collection.find({}).toArray();

  let atualizados = 0;
  let semMudanca = 0;

  for (const registro of registros) {
    const itemAntigo = String(registro.item || "").trim();
    const itemNovo = mapearItemCompleto(itemAntigo);

    const itemOriginalAntigo = String(registro.itemOriginal || "").trim();
    const itemOriginalNovo = itemOriginalAntigo ? mapearItemBase(itemOriginalAntigo) : "";

    const tipoNovo = normalizarTipo(registro.tipo, itemNovo);
    const acaoNovo = normalizarAcao(registro.acao, registro.tipoMovimentacao, itemNovo);
    const tipoMovimentacaoNovo = normalizarTipoMovimentacao(registro.tipoMovimentacao, registro.acao, itemNovo);
    const cargoNovo = normalizarCargo(registro.cargo, itemNovo);
    const canalNomeNovo = String(registro.canalNome || "canal-desconhecido").trim() || "canal-desconhecido";

    const update = {};
    let mudou = false;

    if (itemAntigo !== itemNovo) {
      update.item = itemNovo;
      mudou = true;
    }

    if (itemOriginalAntigo !== itemOriginalNovo) {
      update.itemOriginal = itemOriginalNovo;
      mudou = true;
    }

    if (registro.tipo !== tipoNovo) {
      update.tipo = tipoNovo;
      mudou = true;
    }

    if (registro.acao !== acaoNovo) {
      update.acao = acaoNovo;
      mudou = true;
    }

    if (registro.tipoMovimentacao !== tipoMovimentacaoNovo) {
      update.tipoMovimentacao = tipoMovimentacaoNovo;
      mudou = true;
    }

    if (registro.cargo !== cargoNovo) {
      update.cargo = cargoNovo;
      mudou = true;
    }

    if (registro.canalNome !== canalNomeNovo) {
      update.canalNome = canalNomeNovo;
      mudou = true;
    }

    if (!mudou) {
      semMudanca++;
      continue;
    }

    await MovimentacaoBau.collection.updateOne(
      { _id: registro._id },
      { $set: update }
    );

    atualizados++;
    console.log(
      `📝 Histórico atualizado: ${itemAntigo} -> ${itemNovo} | ` +
      `tipo=${tipoNovo} | acao=${acaoNovo} | tipoMov=${tipoMovimentacaoNovo} | cargo=${cargoNovo}`
    );
  }

  console.log(`🧾 MovimentacaoBau concluído: ${atualizados} atualizados, ${semMudanca} sem mudança.`);
}

async function mostrarResumoFinal() {
  const controle = await ControleBau.find({}).sort({ item: 1 });

  console.log("\n📊 ESTOQUE FINAL:");
  for (const item of controle) {
    console.log(`- ${nomeBonito(item.item)} = ${item.quantidade}`);
  }
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB conectado");

    await migrarControleBau();
    await migrarMovimentacaoBau();
    await mostrarResumoFinal();

    console.log("\n✅ Migração concluída com sucesso.");
    console.log("ℹ️ Chip ilegal e Hacking foram mantidos como itens separados.");
  } catch (error) {
    console.error("❌ Erro na migração:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB desconectado");
  }
}

main();