const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const {
  calcularMetaSemanal,
  formatMoney,
  formatDateBR
} = require("../utils/metaSemanal");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ver-metasemanal")
    .setDescription("Ver a meta semanal de farm")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuário para consultar a meta semanal")
        .setRequired(false)
    ),

  async execute(interaction) {
    const usuario = interaction.options.getUser("usuario") || interaction.user;
    const semana = getSemanaRP();

    const registros = await FarmRegistro.find({
      userId: usuario.id,
      semanaId: semana.semanaId
    }).sort({ registradoEm: -1 });

    const total = registros.reduce((acc, registro) => acc + (registro.valor || 0), 0);
    const resumo = calcularMetaSemanal(total);

    const embed = new EmbedBuilder()
      .setColor(resumo.bateuMeta ? 0x57F287 : 0xFEE75C)
      .setTitle("📊 Meta semanal")
      .setDescription(`Resumo semanal de <@${usuario.id}>`)
      .addFields(
        {
          name: "📅 Período da semana",
          value: `Início: **${formatDateBR(semana.inicio)}**\nFim: **${formatDateBR(semana.fimExibicao)}**`,
          inline: false
        },
        {
          name: "💸 Total farmado",
          value: `**${formatMoney(resumo.valorTotal)}**`,
          inline: true
        },
        {
          name: "🎯 Meta semanal",
          value: `**${formatMoney(resumo.metaSemanal)}**`,
          inline: true
        },
        {
          name: "🏠 Vai para a família",
          value: `**${formatMoney(resumo.valorFamilia)}**`,
          inline: true
        },
        {
          name: "📈 Excedente",
          value: `**${formatMoney(resumo.excedente)}**`,
          inline: true
        },
        {
          name: "🧼 Valor limpo a receber",
          value: `**${formatMoney(resumo.valorLimpo)}**`,
          inline: true
        },
        {
          name: "✅ Status",
          value: resumo.bateuMeta
            ? "Meta batida nesta semana."
            : `Faltam **${formatMoney(resumo.faltante)}** para bater a meta.`,
          inline: false
        }
      )
      .setFooter({
        text: `Semana ID: ${semana.semanaId} | Registros: ${registros.length}`
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
