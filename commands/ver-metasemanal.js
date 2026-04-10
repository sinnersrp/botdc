const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");

const META_SEMANAL = 100000;

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function calcularResumo(total) {
  const valorFamilia = Math.min(total, META_SEMANAL);
  const excedente = Math.max(total - META_SEMANAL, 0);
  const valorLimpo = Math.floor(excedente * 0.5);
  const faltante = Math.max(META_SEMANAL - total, 0);

  return {
    valorFamilia,
    excedente,
    valorLimpo,
    faltante,
    bateuMeta: total >= META_SEMANAL
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ver-metasemanal")
    .setDescription("Mostra o resumo da meta semanal de farm")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuário para consultar")
        .setRequired(false)
    ),

  async execute(interaction) {
    const usuario = interaction.options.getUser("usuario") || interaction.user;
    const semana = getSemanaRP();

    const registros = await FarmRegistro.find({
      userId: usuario.id,
      semanaId: semana.semanaId
    });

    const total = registros.reduce((acc, item) => acc + (item.valor || 0), 0);
    const resumo = calcularResumo(total);

    const embed = new EmbedBuilder()
      .setTitle("📊 Meta semanal")
      .setDescription(`Resumo semanal de ${usuario}`)
      .addFields(
        { name: "🗓️ Semana", value: semana.semanaId, inline: false },
        { name: "💰 Total farmado", value: `R$ ${formatMoney(total)}`, inline: true },
        { name: "🎯 Meta semanal", value: `R$ ${formatMoney(META_SEMANAL)}`, inline: true },
        { name: "🏴 Família recebe", value: `R$ ${formatMoney(resumo.valorFamilia)}`, inline: true },
        { name: "📈 Excedente", value: `R$ ${formatMoney(resumo.excedente)}`, inline: true },
        { name: "🧼 Limpo a receber", value: `R$ ${formatMoney(resumo.valorLimpo)}`, inline: true },
        {
          name: "✅ Status",
          value: resumo.bateuMeta
            ? "Meta batida com sucesso."
            : `Faltam R$ ${formatMoney(resumo.faltante)} para bater a meta.`,
          inline: false
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
