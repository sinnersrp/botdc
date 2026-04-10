const { SlashCommandBuilder } = require("discord.js");
const { criarPainelFarm } = require("../utils/painelFarm");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-farm")
    .setDescription("Envia o painel bonito de registro de farm"),

  async execute(interaction) {
    await interaction.channel.send(criarPainelFarm());

    return interaction.reply({
      content: "✅ Painel de farm enviado com sucesso.",
      flags: 64
    });
  }
};