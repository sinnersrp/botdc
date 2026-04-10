const mongoose = require("mongoose");

const movimentacaoBauSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  cargo: {
    type: String,
    required: true
  },
  acao: {
    type: String,
    enum: ["liberou", "retirou", "devolveu"],
    required: true
  },
  item: {
    type: String,
    required: true
  },
  quantidade: {
    type: Number,
    required: true
  },
  tipo: {
    type: String,
    enum: ["geral", "arma"],
    required: true
  },
  canalId: {
    type: String,
    required: true
  },
  canalNome: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("MovimentacaoBau", movimentacaoBauSchema);