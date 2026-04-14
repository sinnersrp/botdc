const { SlashCommandBuilder } = require("discord.js");
const { criarPainelAvisos } = require("../utils/painelAvisos");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedText
} = require("../utils/canaisPermitidosPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-avisos")
    .setDescription("Envia o painel de avisos neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a liderança pode enviar este painel.",
        flags: 64
      });
    }

    if (!canUsePainelHere("avisos", interaction.channel)) {
      return interaction.reply({
        content: `❌ Este painel só pode ser enviado em: ${getAllowedText("avisos")}.`,
        flags: 64
      });
    }

    await interaction.channel.send(criarPainelAvisos());

    return interaction.reply({
      content: "✅ Painel de avisos enviado neste canal.",
      flags: 64
    });
  }
};