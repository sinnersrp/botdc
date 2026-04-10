const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const { canais } = require("../config/config");
const { isGerenteOuLider } = require("../utils/permissoes");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bau-entrada")
    .setDescription("Adicionar item no baú da gerência")
    .addStringOption(option =>
      option
        .setName("item")
        .setDescription("Nome do item")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("quantidade")
        .setDescription("Quantidade do item")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerência pode usar este comando.",
        ephemeral: true
      });
    }

    if (interaction.channel.id !== canais.entradaBauGerencia) {
      return interaction.reply({
        content: "❌ Use este comando no canal entrada-bau da gerência.",
        ephemeral: true
      });
    }

    const item = interaction.options.getString("item").toLowerCase().trim();
    const quantidade = interaction.options.getInteger("quantidade");

    if (quantidade <= 0) {
      return interaction.reply({
        content: "❌ A quantidade precisa ser maior que 0.",
        ephemeral: true
      });
    }

    let estoque = await ControleBau.findOne({ item: `gerencia_${item}` });

    if (!estoque) {
      estoque = new ControleBau({
        item: `gerencia_${item}`,
        quantidade,
        tipo: "geral"
      });
    } else {
      estoque.quantidade += quantidade;
    }

    await estoque.save();

    return interaction.reply(`✅ ${quantidade}x ${item} adicionado no baú da gerência.`);
  }
};