const { SlashCommandBuilder } = require("discord.js");
const { criarPainelFarm } = require("../utils/painelFarm");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedChannelMentions
} = require("../utils/canaisPermitidosPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-farm")
    .setDescription("Envia o painel de farm neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    if (!canUsePainelHere("farm", interaction.channel)) {
      return interaction.reply({
        content: [
          "❌ Este painel só pode ser enviado no fórum de comandos ou nos canais da área FARM.",
          `📍 Canais permitidos: ${getAllowedChannelMentions("farm") || "configure no config.js"}`
        ].join("\n"),
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