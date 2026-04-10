const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const { isGerenteOuLider } = require("../utils/permissoes");

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ver-farm-membro")
    .setDescription("Ver resumo do farm semanal de um membro")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Membro para consultar")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerência pode usar este comando.",
        flags: 64
      });
    }

    const usuario = interaction.options.getUser("usuario", true);
    const semana = getSemanaRP();

    const registros = await FarmRegistro.find({
      userId: usuario.id,
      semanaId: semana.semanaId
    }).sort({ registradoEm: 1 });

    const total = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const meta = 100000;
    const falta = Math.max(0, meta - total);
    const excedente = Math.max(0, total - meta);
    const valorLimpo = Math.floor(excedente * 0.5);

    const embed = new EmbedBuilder()
      .setColor(total >= meta ? 0x57f287 : 0xed4245)
      .setTitle("💸 Resumo de farm do membro")
      .addFields(
        {
          name: "👤 Membro",
          value: `${usuario}\n**${usuario.username}**`,
          inline: false
        },
        {
          name: "🗓️ Semana",
          value: `**${semana.semanaId}**`,
          inline: false
        },
        {
          name: "📊 Total atual",
          value: `**${formatMoney(total)}**`,
          inline: true
        },
        {
          name: "🧾 Registros",
          value: `**${registros.length}**`,
          inline: true
        },
        {
          name: "🎯 Meta",
          value: `**${formatMoney(meta)}**`,
          inline: true
        },
        {
          name: "❌ Falta para meta",
          value: `**${formatMoney(falta)}**`,
          inline: true
        },
        {
          name: "📈 Excedente",
          value: `**${formatMoney(excedente)}**`,
          inline: true
        },
        {
          name: "💵 Valor limpo estimado",
          value: `**${formatMoney(valorLimpo)}**`,
          inline: true
        }
      )
      .setFooter({
        text: "SINNERS BOT • Consulta de farm"
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      flags: 64
    });
  }
};