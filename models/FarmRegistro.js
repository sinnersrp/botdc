const mongoose = require("mongoose");

const FarmRegistroSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true
    },
    cargo: {
      type: String,
      enum: ["membro", "gerente", "lider", "ajuste"],
      default: "membro"
    },
    valor: {
      type: Number,
      required: true
    },
    comprovante: {
      type: String,
      default: ""
    },
    semanaId: {
      type: String,
      required: true,
      index: true
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

module.exports = mongoose.model("FarmRegistro", FarmRegistroSchema);