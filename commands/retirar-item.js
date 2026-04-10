const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const { canais } = require("../config/config");
const { isMembro } = require("../utils/permissoes");
const logBau = require("../utils/logBau");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("retirar-item")
    .setDescription("Retirar item do controle de baú")
    .addStringOption(option =>
      option.setName("item").setDescription("Nome do item").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("quantidade").setDescription("Quantidade").setRequired(true)
    ),

  async execute(interaction, client) {
    const item = interaction.options.getString("item").toLowerCase().trim();
    const quantidade = interaction.options.getInteger("quantidade");

    if (!isMembro(interaction.member)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para retirar itens.",
        ephemeral: true
      });
    }

    if (interaction.channel.id !== canais.saida) {
      return interaction.reply({
        content: "❌ Use este comando no canal de saída do controle de baú.",
        ephemeral: true
      });
    }

    if (quantidade <= 0) {
      return interaction.reply({
        content: "❌ A quantidade precisa ser maior que 0.",
        ephemeral: true
      });
    }

    const estoque = await ControleBau.findOne({ item });

    if (!estoque || estoque.quantidade < quantidade) {
      return interaction.reply({
        content: "❌ Estoque insuficiente.",
        ephemeral: true
      });
    }

    estoque.quantidade -= quantidade;
    await estoque.save();

    const cargoNome = isMembro(interaction.member) ? "Membro" : "Usuário";

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.tag,
      cargo: cargoNome,
      acao: "retirou",
      item,
      quantidade,
      tipo: estoque.tipo,
      canalId: interaction.channel.id,
      canalNome: interaction.channel.name
    });

    await logBau(client, {
      username: interaction.user.tag,
      cargo: cargoNome,
      acao: "Retirou",
      item,
      quantidade,
      tipo: estoque.tipo,
      canalNome: interaction.channel.name
    });

    return interaction.reply(`📦 Você retirou ${quantidade}x ${item}.`);
  }
};