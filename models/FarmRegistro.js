const mongoose = require("mongoose");

const farmRegistroSchema = new mongoose.Schema(
  {
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
      enum: ["membro", "gerente", "lider"],
      required: true
    },
    valor: {
      type: Number,
      required: true,
      min: 1
    },
    semanaId: {
      type: String,
      required: true
    },
    registradoEm: {
      type: Date,
      default: Date.now
    },
    origem: {
      type: String,
      default: "bot"
    },
    observacao: {
      type: String,
      default: ""
    },
    comprovanteUrl: {
      type: String,
      default: ""
    },
    comprovanteNome: {
      type: String,
      default: ""
    },
    canalId: {
      type: String,
      default: ""
    },
    canalNome: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("FarmRegistro", farmRegistroSchema);