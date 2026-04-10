const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ver-estoque")
    .setDescription("Ver estoque do controle de baú"),

  async execute(interaction) {
    const itens = await ControleBau.find().sort({ item: 1 });

    if (!itens.length) {
      return interaction.reply("📭 Estoque vazio.");
    }

    let mensagem = "📦 **ESTOQUE ATUAL**\n\n";

    itens.forEach(i => {
      if (!i.item.startsWith("gerencia_")) {
        mensagem += `• ${i.item}: ${i.quantidade}\n`;
      }
    });

    interaction.reply(mensagem);
  }
};