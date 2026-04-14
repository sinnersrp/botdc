const { SlashCommandBuilder } = require("discord.js");
const { criarPainelRegistro } = require("../utils/registroMembro");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedChannelMentions
} = require("../utils/canaisPermitidosPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-registro")
    .setDescription("Envia o painel de registro neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    if (!canUsePainelHere("registro", interaction.channel)) {
      return interaction.reply({
        content: [
          "❌ Este painel só pode ser enviado no fórum de comandos ou nos canais da área de registro.",
          `📍 Canais permitidos: ${getAllowedChannelMentions("registro") || "configure no config.js"}`
        ].join("\n"),
        flags: 64
      });
    }

    await interaction.channel.send(criarPainelRegistro());

    return interaction.reply({
      content: "✅ Painel de registro enviado neste canal.",
      flags: 64
    });
  }
};