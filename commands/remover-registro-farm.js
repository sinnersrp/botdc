const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const { sincronizarPlanilhaFarm } = require("../utils/googleSheetsFarm");
const { isGerenteOuLider } = require("../utils/permissoes");

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remover-registro-farm")
    .setDescription("Remove um valor específico do dinheiro sujo de um membro")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Membro que terá valor removido")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("valor")
        .setDescription("Quantidade de dinheiro que deseja remover")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("motivo")
        .setDescription("Motivo da remoção")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("semana")
        .setDescription("Semana no formato 2026-04-11_2026-04-18. Se não informar, usa a atual.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a liderança pode remover valores do farm.",
        flags: 64
      });
    }

    const usuario = interaction.options.getUser("usuario", true);
    const valor = interaction.options.getInteger("valor", true);
    const motivo = interaction.options.getString("motivo", true).trim();
    const semanaInformada = interaction.options.getString("semana");

    const semanaAtual = getSemanaRP();
    const semanaId = semanaInformada?.trim() || semanaAtual.semanaId;

    const registros = await FarmRegistro.find({
      userId: usuario.id,
      semanaId
    }).sort({ registradoEm: -1 });

    if (!registros.length) {
      return interaction.reply({
        content: `❌ Nenhum registro encontrado para **${usuario.username}** na semana **${semanaId}**.`,
        flags: 64
      });
    }

    const totalAtual = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

    if (valor > totalAtual) {
      return interaction.reply({
        content: [
          `❌ Não é possível remover **R$ ${formatMoney(valor)}**.`,
          `📊 Total atual de **${usuario.username}** na semana **${semanaId}**: **R$ ${formatMoney(totalAtual)}**`
        ].join("\n"),
        flags: 64
      });
    }

    const novoRegistro = await FarmRegistro.create({
      userId: usuario.id,
      username: usuario.username,
      cargo: "ajuste",
      valor: -Math.abs(valor),
      comprovante: `REMOÇÃO MANUAL: ${motivo}`,
      semanaId,
      registradoEm: new Date()
    });

    const totalDepois = totalAtual - Math.abs(valor);

    try {
      if (interaction.guild) {
        await sincronizarPlanilhaFarm(interaction.guild);
      }
    } catch (error) {
      console.error("Erro ao sincronizar planilha após remoção:", error);
    }

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("🗑️ Remoção de valor do dinheiro sujo")
      .setDescription(
        [
          `👤 Membro: ${usuario}`,
          `🗓️ Semana: **${semanaId}**`,
          `💸 Valor removido: **R$ ${formatMoney(valor)}**`,
          `📊 Total antes: **R$ ${formatMoney(totalAtual)}**`,
          `📉 Total depois: **R$ ${formatMoney(totalDepois)}**`,
          `📝 Motivo: **${motivo}**`,
          `🆔 Registro de ajuste: \`${novoRegistro._id}\``
        ].join("\n")
      )
      .setFooter({ text: "SINNERS BOT • Remoção de valor" })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      flags: 64
    });
  }
};