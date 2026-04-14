const mongoose = require("mongoose");

const TIPOS_VALIDOS = [
  "bau_gerencia",
  "controle_bau"
];

const ACOES_VALIDAS = [
  "entrada",
  "saida",
  "transferir",
  "transferencia_controle",
  "liberar",
  "retirar",
  "devolver"
];

const CARGOS_VALIDOS = [
  "gerencia",
  "membro"
];

const MovimentacaoBauSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    item: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    itemOriginal: {
      type: String,
      default: "",
      trim: true
    },
    quantidade: {
      type: Number,
      required: true,
      min: 1
    },

    // Campo legado já usado no projeto
    tipoMovimentacao: {
      type: String,
      required: true,
      enum: ACOES_VALIDAS
    },

    observacao: {
      type: String,
      default: "Sem observação",
      trim: true
    },

    canalId: {
      type: String,
      required: true,
      trim: true
    },
    canalNome: {
      type: String,
      required: true,
      trim: true
    },

    // Novo padrão do sistema
    tipo: {
      type: String,
      required: true,
      enum: TIPOS_VALIDOS
    },
    acao: {
      type: String,
      required: true,
      enum: ACOES_VALIDAS
    },
    cargo: {
      type: String,
      required: true,
      enum: CARGOS_VALIDOS
    },

    registradoEm: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

MovimentacaoBauSchema.index({ registradoEm: -1 });
MovimentacaoBauSchema.index({ item: 1, registradoEm: -1 });
MovimentacaoBauSchema.index({ canalId: 1, registradoEm: -1 });
MovimentacaoBauSchema.index({ tipo: 1, acao: 1, registradoEm: -1 });

module.exports = mongoose.model("MovimentacaoBau", MovimentacaoBauSchema);