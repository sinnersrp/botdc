const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { criarPainelBau } = require("../utils/painelBau");
const { enviarPainelNoForum } = require("../utils/forumPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-bau")
    .setDescription("Envia o painel bonito do baú da gerência no fórum comando-bot"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        flags: 64
      });
    }

    await enviarPainelNoForum(
      interaction.client,
      "📦 Painel do Baú da Gerência",
      criarPainelBau()
    );

    return interaction.reply({
      content: "✅ Painel do baú da gerência enviado no fórum comando-bot.",
      flags: 64
    });
  }
};