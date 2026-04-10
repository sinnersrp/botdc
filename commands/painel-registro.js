const { SlashCommandBuilder } = require("discord.js");
const { canais } = require("../config/config");
const { isGerenteOuLider } = require("../utils/permissoes");
const { criarPainelRegistro } = require("../utils/registroMembro");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-registro")
    .setDescription("Envia o painel de registro no canal de registro"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode usar este comando.",
        ephemeral: true
      });
    }

    const canalRegistro = interaction.guild.channels.cache.get(canais.registro);

    if (!canalRegistro) {
      return interaction.reply({
        content: "❌ Canal de registro não encontrado no config.",
        ephemeral: true
      });
    }

    await canalRegistro.send(criarPainelRegistro());

    return interaction.reply({
      content: "✅ Painel de registro enviado com sucesso.",
      ephemeral: true
    });
  }
};