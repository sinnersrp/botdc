const { SlashCommandBuilder } = require("discord.js");
const { criarPainelAvisos } = require("../utils/painelAvisos");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedChannelMentions
} = require("../utils/canaisPermitidosPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-avisos")
    .setDescription("Envia o painel de avisos neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    if (!canUsePainelHere("avisos", interaction.channel)) {
      return interaction.reply({
        content: [
          "❌ Este painel só pode ser enviado no fórum de comandos ou nos canais da área de avisos.",
          `📍 Canais permitidos: ${getAllowedChannelMentions("avisos") || "configure no config.js"}`
        ].join("\n"),
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