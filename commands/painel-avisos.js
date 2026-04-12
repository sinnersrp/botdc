const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { criarPainelAvisos } = require("../utils/painelAvisos");
const { enviarPainelNoForum } = require("../utils/forumPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-avisos")
    .setDescription("Envia o painel bonito de avisos no fórum comando-bot"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        flags: 64
      });
    }

    await enviarPainelNoForum(
      interaction.client,
      "📢 Painel de Avisos",
      criarPainelAvisos()
    );

    return interaction.reply({
      content: "✅ Painel de avisos enviado no fórum comando-bot.",
      flags: 64
    });
  }
};