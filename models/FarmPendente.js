const mongoose = require("mongoose");

const FarmPendenteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    valor: { type: Number, required: true },
    semanaId: { type: String, required: true },
    canalId: { type: String, required: true },
    criadoEm: { type: Date, default: Date.now },
    expiraEm: { type: Date, required: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("FarmPendente", FarmPendenteSchema);