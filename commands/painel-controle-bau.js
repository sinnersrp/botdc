const { SlashCommandBuilder } = require("discord.js");
const { criarPainelControleBau } = require("../utils/painelControleBau");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-controle-bau")
    .setDescription("Envia o painel bonito do controle de baú"),

  async execute(interaction) {
    await interaction.channel.send(criarPainelControleBau());

    return interaction.reply({
      content: "✅ Painel do controle de baú enviado com sucesso.",
      flags: 64
    });
  }
};