const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { REGISTRO_BUTTON_ID } = require("../utils/registroMembro");
const { enviarPainelNoForum } = require("../utils/forumPainel");

function criarPainelRegistroForum() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📋 Registro de Novo Membro")
    .setDescription(
      [
        "Clique no botão abaixo para preencher seu registro.",
        "",
        "**Preencha corretamente:**",
        "• Nome",
        "• Passaporte",
        "• Número em game"
      ].join("\n")
    )
    .setFooter({
      text: "SINNERS BOT • Registro"
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(REGISTRO_BUTTON_ID)
      .setLabel("Fazer registro")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Success)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-registro")
    .setDescription("Envia o painel de registro no fórum comando-bot"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        flags: 64
      });
    }

    await enviarPainelNoForum(
      interaction.client,
      "📋 Painel de Registro",
      criarPainelRegistroForum()
    );

    return interaction.reply({
      content: "✅ Painel de registro enviado no fórum comando-bot.",
      flags: 64
    });
  }
};