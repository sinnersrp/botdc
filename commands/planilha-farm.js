const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("planilha-farm")
    .setDescription("Mostra o link da planilha online do farm"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    const sheetId = process.env.GOOGLE_SHEETS_ID;

    if (!sheetId) {
      return interaction.reply({
        content: "❌ GOOGLE_SHEETS_ID não configurado no .env",
        flags: 64
      });
    }

    return interaction.reply({
      content: `📄 Planilha do farm:\nhttps://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      flags: 64
    });
  }
};