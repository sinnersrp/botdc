const mongoose = require("mongoose");

const FarmPendenteSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    canalId: {
      type: String,
      required: true
    },
    semanaId: {
      type: String,
      required: true
    },
    valor: {
      type: Number,
      required: true,
      min: 1
    },
    criadoEm: {
      type: Date,
      default: Date.now
    },
    expiraEm: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

FarmPendenteSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("FarmPendente", FarmPendenteSchema);