const { SlashCommandBuilder } = require("discord.js");
const { criarPainelControleBau } = require("../utils/painelControleBau");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedChannelMentions
} = require("../utils/canaisPermitidosPainel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-controle-bau")
    .setDescription("Envia o painel do controle de baú neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    if (!canUsePainelHere("controle_bau", interaction.channelId)) {
      return interaction.reply({
        content: [
          "❌ Este painel só pode ser enviado no fórum de comandos ou no canal de controle de baú.",
          `📍 Canais permitidos: ${getAllowedChannelMentions("controle_bau") || "configure no config.js"}`
        ].join("\n"),
        flags: 64
      });
    }

    await interaction.channel.send(criarPainelControleBau());

    return interaction.reply({
      content: "✅ Painel do controle de baú enviado neste canal.",
      flags: 64
    });
  }
};