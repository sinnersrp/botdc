const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const MovimentacaoCaixa = require("../models/MovimentacaoCaixa");
const { sincronizarCaixaFaccao } = require("../utils/financeiroFaccao");
const { sincronizarPlanilhaFarm } = require("../utils/googleSheetsFarm");

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lavar-dinheiro")
    .setDescription("Registra a lavagem de dinheiro sujo para o caixa da facção")
    .addIntegerOption(option =>
      option
        .setName("valor")
        .setDescription("Valor que será lavado")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName("observacao")
        .setDescription("Observação sobre a lavagem")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    const valor = interaction.options.getInteger("valor", true);
    const observacao = interaction.options.getString("observacao", true);

    const caixaAntes = await sincronizarCaixaFaccao();

    if (valor > caixaAntes.dinheiroSujoDisponivel) {
      return interaction.editReply({
        content: [
          "❌ Não há dinheiro sujo disponível suficiente para essa lavagem.",
          `💸 Disponível: **R$ ${formatMoney(caixaAntes.dinheiroSujoDisponivel)}**`
        ].join("\n")
      });
    }

    await MovimentacaoCaixa.create({
      responsavelId: interaction.user.id,
      responsavelTag: interaction.user.tag,
      tipo: "lavagem",
      valor,
      observacao,
      registradoEm: new Date()
    });

    const caixaDepois = await sincronizarCaixaFaccao();

    await sincronizarPlanilhaFarm(interaction.guild).catch((error) => {
      console.error("Erro ao sincronizar planilha após lavagem:", error);
    });

    return interaction.editReply({
      content: [
        "✅ Lavagem registrada com sucesso.",
        `🧼 Valor lavado: **R$ ${formatMoney(valor)}**`,
        `🏦 Caixa atual: **R$ ${formatMoney(caixaDepois.caixaTotal)}**`,
        `💸 Sujo disponível agora: **R$ ${formatMoney(caixaDepois.dinheiroSujoDisponivel)}**`,
        `📝 Observação: **${observacao}**`
      ].join("\n")
    });
  }
};