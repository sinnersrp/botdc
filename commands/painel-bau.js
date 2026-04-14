const { SlashCommandBuilder } = require("discord.js");
const { criarPainelBau } = require("../utils/painelBau");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedChannelMentions
} = require("../utils/canaisPermitidosPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-bau")
    .setDescription("Envia o painel do baú da gerência neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    if (!canUsePainelHere("bau", interaction.channel)) {
      return interaction.reply({
        content: [
          "❌ Este painel só pode ser enviado no fórum de comandos ou nos canais da área do baú.",
          `📍 Canais permitidos: ${getAllowedChannelMentions("bau") || "configure no config.js"}`
        ].join("\n"),
        flags: 64
      });
    }

    await interaction.channel.send(criarPainelBau());

    return interaction.reply({
      content: "✅ Painel do baú enviado neste canal.",
      flags: 64
    });
  }
};