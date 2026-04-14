const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const {
  canUsePainelHere,
  getAllowedChannelMentions
} = require("../utils/canaisPermitidosPainel");

function criarPainelGerencia() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("🛠️ Painel da Gerência")
    .setDescription(
      [
        "Comandos úteis da gerência:",
        "",
        "• `/ver-caixa`",
        "• `/lavar-dinheiro`",
        "• `/historico-caixa`",
        "• `/ajuste-gerencia dinheiro-sujo`",
        "• `/ajuste-gerencia estoque`"
      ].join("\n")
    )
    .setFooter({
      text: "SINNERS BOT • Gerência"
    })
    .setTimestamp();

  return { embeds: [embed] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-gerencia")
    .setDescription("Envia o painel da gerência neste canal"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    if (!canUsePainelHere("gerencia", interaction.channelId)) {
      return interaction.reply({
        content: [
          "❌ Este painel só pode ser enviado no fórum de comandos ou em canal de gerência.",
          `📍 Canais permitidos: ${getAllowedChannelMentions("gerencia") || "configure no config.js"}`
        ].join("\n"),
        flags: 64
      });
    }

    await interaction.channel.send(criarPainelGerencia());

    return interaction.reply({
      content: "✅ Painel da gerência enviado neste canal.",
      flags: 64
    });
  }
};