const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const { isGerenteOuLider } = require("../utils/permissoes");
const { enviarPainelNoForum } = require("../utils/forumPainel");
const { criarPainelAvisos } = require("../utils/painelAvisos");
const { criarPainelBau } = require("../utils/painelBau");
const { criarPainelControleBau } = require("../utils/painelControleBau");
const { criarPainelFarm } = require("../utils/painelFarm");
const { REGISTRO_BUTTON_ID } = require("../utils/registroMembro");

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
    .setName("painel-gerencia")
    .setDescription("Cria ou atualiza todos os paineis da gerência no fórum comando-bot"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      await enviarPainelNoForum(
        interaction.client,
        "📢 Painel de Avisos",
        criarPainelAvisos()
      );

      await enviarPainelNoForum(
        interaction.client,
        "📋 Painel de Registro",
        criarPainelRegistroForum()
      );

      await enviarPainelNoForum(
        interaction.client,
        "📦 Painel do Baú da Gerência",
        criarPainelBau()
      );

      await enviarPainelNoForum(
        interaction.client,
        "📦 Painel do Controle de Baú",
        criarPainelControleBau()
      );

      await enviarPainelNoForum(
        interaction.client,
        "💸 Painel de Farm",
        criarPainelFarm()
      );

      await interaction.editReply({
        content: [
          "✅ Todos os painéis da gerência foram criados/atualizados no fórum comando-bot.",
          "",
          "**Painéis enviados:**",
          "• 📢 Painel de Avisos",
          "• 📋 Painel de Registro",
          "• 📦 Painel do Baú da Gerência",
          "• 📦 Painel do Controle de Baú",
          "• 💸 Painel de Farm"
        ].join("\n")
      });
    } catch (error) {
      console.error("Erro ao criar os painéis da gerência:", error);

      await interaction.editReply({
        content: "❌ Ocorreu um erro ao criar os painéis da gerência."
      });
    }
  }
};