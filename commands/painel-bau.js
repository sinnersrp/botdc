const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { criarPainelBau } = require("../utils/painelBau");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-bau")
    .setDescription("Envia o painel bonito do baú da gerência"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        flags: 64
      });
    }

    await interaction.channel.send(criarPainelBau());

    return interaction.reply({
      content: "✅ Painel do baú enviado com sucesso.",
      flags: 64
    });
  }
};