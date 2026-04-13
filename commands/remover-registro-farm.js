const { SlashCommandBuilder } = require("discord.js");
const FarmRegistro = require("../models/FarmRegistro");
const { isGerenteOuLider } = require("../utils/permissoes");
const logAjuste = require("../utils/logAjuste");
const { sincronizarPlanilhaFarm } = require("../utils/googleSheetsFarm");
const { sincronizarCaixaFaccao } = require("../utils/financeiroFaccao");

function formatMoney(value) {
  const numero = Number(value) || 0;
  return new Intl.NumberFormat("pt-BR").format(numero);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remover-registro-dinheiro-sujo")
    .setDescription("Remove um registro específico de dinheiro sujo pelo ID")
    .addStringOption(option =>
      option
        .setName("id")
        .setDescription("ID do registro que será removido")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo da remoção")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    const id = interaction.options.getString("id", true).trim();
    const motivo = interaction.options.getString("motivo", true).trim();

    const registro = await FarmRegistro.findById(id);

    if (!registro) {
      return interaction.editReply({
        content: "❌ Registro não encontrado."
      });
    }

    const dadosRegistro = {
      userId: registro.userId,
      username: registro.username,
      valor: registro.valor,
      cargo: registro.cargo,
      semanaId: registro.semanaId,
      comprovante: registro.comprovante,
      registradoEm: registro.registradoEm
    };

    await FarmRegistro.deleteOne({ _id: registro._id });

    const registrosRestantes = await FarmRegistro.find({
      userId: dadosRegistro.userId,
      semanaId: dadosRegistro.semanaId
    });

    const totalAtual = registrosRestantes.reduce(
      (acc, item) => acc + (Number(item.valor) || 0),
      0
    );

    await logAjuste(client, {
      tipo: "Remoção de registro de dinheiro sujo",
      responsavel: interaction.user.tag,
      alvo: `${dadosRegistro.username} (${dadosRegistro.userId})`,
      acao: "remover registro",
      valor: dadosRegistro.valor,
      motivo: `${motivo} | Registro removido: ${id}`
    });

    await sincronizarCaixaFaccao().catch((error) => {
      console.error("Erro ao sincronizar caixa após remover registro:", error);
    });

    await sincronizarPlanilhaFarm(interaction.guild).catch((error) => {
      console.error("Erro ao sincronizar planilha após remover registro:", error);
    });

    return interaction.editReply({
      content: [
        "✅ Registro de dinheiro sujo removido com sucesso.",
        `👤 Usuário: **${dadosRegistro.username}**`,
        `🆔 Registro removido: \`${id}\``,
        `💰 Valor removido: **R$ ${formatMoney(dadosRegistro.valor)}**`,
        `🗓️ Semana: **${dadosRegistro.semanaId}**`,
        `📊 Total atual da semana: **R$ ${formatMoney(totalAtual)}**`
      ].join("\n")
    });
  }
};