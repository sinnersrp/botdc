const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { criarPainelControleBau } = require("../utils/painelControleBau");
const { enviarPainelNoForum } = require("../utils/forumPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-controle-bau")
    .setDescription("Envia o painel bonito do controle de baú no fórum comando-bot"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        flags: 64
      });
    }

    await enviarPainelNoForum(
      interaction.client,
      "📦 Painel do Controle de Baú",
      criarPainelControleBau()
    );

    return interaction.reply({
      content: "✅ Painel do controle de baú enviado no fórum comando-bot.",
      flags: 64
    });
  }
};