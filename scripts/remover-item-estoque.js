require("dotenv").config();
const mongoose = require("mongoose");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");

const ITEM_PARA_REMOVER = "fivem";

function normalizarTexto(valor = "") {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB conectado");

    const itemNormalizado = normalizarTexto(ITEM_PARA_REMOVER);

    const registrosControle = await ControleBau.find({
      item: { $regex: new RegExp(`^${itemNormalizado}$`, "i") }
    });

    if (!registrosControle.length) {
      console.log(`⚠️ Item "${ITEM_PARA_REMOVER}" não encontrado no ControleBau.`);
    } else {
      const total = registrosControle.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0);

      await ControleBau.deleteMany({
        item: { $regex: new RegExp(`^${itemNormalizado}$`, "i") }
      });

      console.log(`🗑️ Item removido do ControleBau: ${ITEM_PARA_REMOVER}`);
      console.log(`📦 Quantidade removida: ${total}`);
    }

    const historicos = await MovimentacaoBau.find({
      $or: [
        { item: { $regex: new RegExp(`^${itemNormalizado}$`, "i") } },
        { itemOriginal: { $regex: new RegExp(`^${itemNormalizado}$`, "i") } }
      ]
    });

    if (!historicos.length) {
      console.log(`ℹ️ Nenhum histórico encontrado para "${ITEM_PARA_REMOVER}".`);
    } else {
      console.log(`ℹ️ Foram encontrados ${historicos.length} registros no histórico para "${ITEM_PARA_REMOVER}".`);
      console.log("ℹ️ O histórico NÃO foi apagado por segurança.");
      console.log("ℹ️ Se quiser, depois eu te mando um script para apagar o histórico também.");
    }

    console.log("✅ Processo concluído.");
  } catch (error) {
    console.error("❌ Erro ao remover item:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB desconectado");
  }
}

main();