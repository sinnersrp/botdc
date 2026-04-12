const mongoose = require("mongoose");

const AvisoAgendadoSchema = new mongoose.Schema(
  {
    criadoPorId: {
      type: String,
      required: true
    },
    criadoPorTag: {
      type: String,
      required: true
    },
    guildId: {
      type: String,
      required: true
    },
    canalId: {
      type: String,
      required: true
    },
    titulo: {
      type: String,
      required: true
    },
    mensagem: {
      type: String,
      required: true
    },
    mencaoTipo: {
      type: String,
      enum: ["everyone", "membro", "nenhum"],
      default: "nenhum"
    },
    agendarPara: {
      type: Date,
      required: true,
      index: true
    },
    agendarTexto: {
      type: String,
      required: true
    },
    enviado: {
      type: Boolean,
      default: false,
      index: true
    },
    enviadoEm: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("AvisoAgendado", AvisoAgendadoSchema);