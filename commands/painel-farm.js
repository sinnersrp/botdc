const { SlashCommandBuilder } = require("discord.js");
const { criarPainelFarm } = require("../utils/painelFarm");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedText
} = require("../utils/canaisPermitidosPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-farm")
    .setDescription("Envia o painel de farm neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a liderança pode enviar este painel.",
        flags: 64
      });
    }

    if (!canUsePainelHere("farm", interaction.channel)) {
      return interaction.reply({
        content: `❌ Este painel só pode ser enviado em: ${getAllowedText("farm")}.`,
        flags: 64
      });
    }

    await interaction.channel.send(criarPainelFarm());

    return interaction.reply({
      content: "✅ Painel de farm enviado neste canal.",
      flags: 64
    });
  }
};