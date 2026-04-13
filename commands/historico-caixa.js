const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const MovimentacaoCaixa = require("../models/MovimentacaoCaixa");

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("historico-caixa")
    .setDescription("Mostra o histórico recente do caixa da facção"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    const movimentacoes = await MovimentacaoCaixa.find({})
      .sort({ registradoEm: -1 })
      .limit(15);

    if (!movimentacoes.length) {
      return interaction.editReply({
        content: "❌ Ainda não existe histórico de caixa."
      });
    }

    const descricao = movimentacoes
      .map((mov, index) => {
        return [
          `**#${index + 1}**`,
          `Tipo: **${mov.tipo}**`,
          `Valor: **R$ ${formatMoney(mov.valor)}**`,
          `Responsável: **${mov.responsavelTag}**`,
          `Data: **${new Date(mov.registradoEm).toLocaleString("pt-BR")}**`,
          `Obs: ${mov.observacao || "Sem observação"}`
        ].join("\n");
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📜 Histórico do caixa")
      .setDescription(descricao)
      .setFooter({
        text: "SINNERS BOT • Histórico financeiro"
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed]
    });
  }
};