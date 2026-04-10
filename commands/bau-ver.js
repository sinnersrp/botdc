const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bau-ver")
    .setDescription("Ver estoque do baú da gerência"),

  async execute(interaction) {
    const itens = await ControleBau.find({
      item: { $regex: "^gerencia_" }
    }).sort({ item: 1 });

    if (!itens.length) {
      return interaction.reply("📭 O baú da gerência está vazio.");
    }

    let mensagem = "🔒 **BAÚ DA GERÊNCIA**\n\n";

    for (const item of itens) {
      mensagem += `• ${item.item.replace("gerencia_", "")}: ${item.quantidade}\n`;
    }

    return interaction.reply(mensagem);
  }
};