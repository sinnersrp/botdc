const mongoose = require("mongoose");

const botAgendaStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("BotAgendaState", botAgendaStateSchema);