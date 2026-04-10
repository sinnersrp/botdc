const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const { canais, todosItens } = require("../config/config");
const { isGerenteOuLider } = require("../utils/permissoes");

const opcoesItens = [
  { name: "Maconha", value: "maconha" },
  { name: "Metafetamina", value: "metafetamina" },
  { name: "Cocaína", value: "cocaina" },
  { name: "Muni PT", value: "muni pt" },
  { name: "Muni SUB", value: "muni sub" },
  { name: "Attachs", value: "attachs" },
  { name: "Colete", value: "colete" },
  { name: "Algema", value: "algema" },
  { name: "Dinheiro Sujo", value: "dinheiro sujo" },
  { name: "SUB", value: "sub" },
  { name: "FiveSeven", value: "fiveseven" },
  { name: "C4", value: "c4" }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bau-saida")
    .setDescription("Retirar item do baú da gerência")
    .addStringOption(option =>
      option
        .setName("item")
        .setDescription("Selecione o item")
        .setRequired(true)
        .addChoices(...opcoesItens)
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

    if (interaction.channel.id !== canais.saidaBauGerencia) {
      return interaction.reply({
        content: "❌ Use este comando no canal saida-bau da gerência.",
        ephemeral: true
      });
    }

    const item = interaction.options.getString("item");
    const quantidade = interaction.options.getInteger("quantidade");

    if (quantidade <= 0) {
      return interaction.reply({
        content: "❌ A quantidade precisa ser maior que 0.",
        ephemeral: true
      });
    }

    if (!todosItens.includes(item)) {
      return interaction.reply({
        content: "❌ Item inválido.",
        ephemeral: true
      });
    }

    const estoque = await ControleBau.findOne({ item: `gerencia_${item}` });

    if (!estoque || estoque.quantidade < quantidade) {
      return interaction.reply({
        content: "❌ Estoque insuficiente no baú da gerência.",
        ephemeral: true
      });
    }

    estoque.quantidade -= quantidade;
    await estoque.save();

    return interaction.reply(
      `📤 ${quantidade}x ${item} retirado do baú da gerência.`
    );
  },
};
