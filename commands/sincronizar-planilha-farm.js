const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { sincronizarPlanilhaFarm } = require("../utils/googleSheetsFarm");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sincronizar-planilha-farm")
    .setDescription("Sincroniza a planilha online do farm"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      const resultado = await sincronizarPlanilhaFarm(interaction.guild);

      return interaction.editReply({
        content: [
          "✅ Planilha sincronizada com sucesso.",
          `🧾 Registros: **${resultado.totalRegistros}**`,
          `🗓️ Semanas: **${resultado.totalSemanas}**`,
          `📄 Planilha: ${resultado.link}`
        ].join("\n")
      });
    } catch (error) {
      console.error("Erro ao sincronizar planilha do farm:", error);

      return interaction.editReply({
        content: "❌ Erro ao sincronizar a planilha do farm."
      });
    }
  }
};