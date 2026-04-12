const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { criarPainelFarm } = require("../utils/painelFarm");
const { enviarPainelNoForum } = require("../utils/forumPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-farm")
    .setDescription("Envia o painel bonito de farm no fórum comando-bot"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        flags: 64
      });
    }

    await enviarPainelNoForum(
      interaction.client,
      "💸 Painel de Farm",
      criarPainelFarm()
    );

    return interaction.reply({
      content: "✅ Painel de farm enviado no fórum comando-bot.",
      flags: 64
    });
  }
};