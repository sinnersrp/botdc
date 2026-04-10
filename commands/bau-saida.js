const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const { canais, todosItens } = require("../config/config");
const { isGerenteOuLider } = require("../utils/permissoes");

const opcoesItens = [
  { name: "📦 Maconha", value: "maconha" },
  { name: "📦 Metafetamina", value: "metafetamina" },
  { name: "📦 Cocaína", value: "cocaina" },
  { name: "📦 Attachs", value: "attachs" },
  { name: "📦 Colete", value: "colete" },
  { name: "📦 Algema", value: "algema" },
  { name: "📦 Envelope", value: "envelope" },
  { name: "📦 Lockpick", value: "lockpick" },
  { name: "📦 Chip Ilegal", value: "chip ilegal" },
  { name: "📦 Adrenalina", value: "adrenalina" },
  { name: "📦 Bandagem", value: "bandagem" },
  { name: "📦 Hacking", value: "hacking" },
  { name: "🔫 Muni PT", value: "muni pt" },
  { name: "🔫 Muni SUB", value: "muni sub" },
  { name: "🔫 SUB", value: "sub" },
  { name: "🔫 FiveSeven", value: "fiveseven" },
  { name: "🔫 HHK", value: "hhk" },
  { name: "🔫 MP5", value: "mp5" },
  { name: "🔫 C4", value: "c4" }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bau-saida")
    .setDescription("Retirar até 3 itens do baú da gerência")
    .addStringOption(option =>
      option.setName("item1").setDescription("Primeiro item").setRequired(true).addChoices(...opcoesItens)
    )
    .addIntegerOption(option =>
      option.setName("quantidade1").setDescription("Quantidade do primeiro item").setRequired(true).setMinValue(1)
    )
    .addStringOption(option =>
      option.setName("item2").setDescription("Segundo item").setRequired(false).addChoices(...opcoesItens)
    )
    .addIntegerOption(option =>
      option.setName("quantidade2").setDescription("Quantidade do segundo item").setRequired(false).setMinValue(1)
    )
    .addStringOption(option =>
      option.setName("item3").setDescription("Terceiro item").setRequired(false).addChoices(...opcoesItens)
    )
    .addIntegerOption(option =>
      option.setName("quantidade3").setDescription("Quantidade do terceiro item").setRequired(false).setMinValue(1)
    ),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({ content: "❌ Apenas gerência pode usar este comando.", flags: 64 });
    }

    if (interaction.channel.id !== canais.saidaBauGerencia) {
      return interaction.reply({ content: "❌ Use este comando no canal saida-bau da gerência.", flags: 64 });
    }

    const pares = [
      { item: interaction.options.getString("item1"), quantidade: interaction.options.getInteger("quantidade1") },
      { item: interaction.options.getString("item2"), quantidade: interaction.options.getInteger("quantidade2") },
      { item: interaction.options.getString("item3"), quantidade: interaction.options.getInteger("quantidade3") }
    ].filter(p => p.item && p.quantidade);

    const itensUsados = new Set();
    for (const par of pares) {
      if (itensUsados.has(par.item)) {
        return interaction.reply({ content: `❌ O item **${par.item}** foi repetido no mesmo comando.`, flags: 64 });
      }
      itensUsados.add(par.item);

      if (!todosItens.includes(par.item)) {
        return interaction.reply({ content: `❌ O item **${par.item}** é inválido.`, flags: 64 });
      }
    }

    for (const par of pares) {
      const estoque = await ControleBau.findOne({ item: `gerencia_${par.item}` });
      if (!estoque || estoque.quantidade < par.quantidade) {
        return interaction.reply({
          content: `❌ Estoque insuficiente para **${par.item}** no baú da gerência.`,
          flags: 64
        });
      }
    }

    const resposta = [];

    for (const par of pares) {
      const estoque = await ControleBau.findOne({ item: `gerencia_${par.item}` });
      estoque.quantidade -= par.quantidade;
      await estoque.save();
      resposta.push(`• ${par.quantidade}x ${par.item}`);
    }

    return interaction.reply({
      content: `📤 Itens retirados do baú da gerência:\n${resposta.join("\n")}`,
      flags: 64
    });
  }
};