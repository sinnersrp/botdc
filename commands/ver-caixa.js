const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { sincronizarCaixaFaccao } = require("../utils/financeiroFaccao");

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ver-caixa")
    .setDescription("Mostra o resumo financeiro da facção"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    const caixa = await sincronizarCaixaFaccao();

    const embed = new EmbedBuilder()
      .setColor(0x8e44ad)
      .setTitle("🏦 Resumo financeiro da facção")
      .addFields(
        {
          name: "💸 Dinheiro sujo total",
          value: `**R$ ${formatMoney(caixa.dinheiroSujoTotal)}**`,
          inline: true
        },
        {
          name: "🧾 Dinheiro sujo disponível",
          value: `**R$ ${formatMoney(caixa.dinheiroSujoDisponivel)}**`,
          inline: true
        },
        {
          name: "🧼 Dinheiro limpo total",
          value: `**R$ ${formatMoney(caixa.dinheiroLimpoTotal)}**`,
          inline: true
        },
        {
          name: "🏦 Caixa total",
          value: `**R$ ${formatMoney(caixa.caixaTotal)}**`,
          inline: true
        },
        {
          name: "🔄 Total lavado",
          value: `**R$ ${formatMoney(caixa.totalLavado)}**`,
          inline: true
        },
        {
          name: "⏱️ Última sincronização",
          value: caixa.ultimaSincronizacao
            ? `**${new Date(caixa.ultimaSincronizacao).toLocaleString("pt-BR")}**`
            : "**Nunca**",
          inline: true
        }
      )
      .setFooter({
        text: "SINNERS BOT • Caixa da facção"
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed]
    });
  }
};