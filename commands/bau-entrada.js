const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const { canais, itensGerais, itensArmas } = require("../config/config");
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
  { name: "📦 Capuz", value: "capuz" },
  { name: "🔫 Muni PT", value: "muni pt" },
  { name: "🔫 Muni SUB", value: "muni sub" },
  { name: "🔫 Muni de Refle", value: "muni de refle" },
  { name: "🔫 SUB", value: "sub" },
  { name: "🔫 FiveSeven", value: "fiveseven" },
  { name: "🔫 HHK", value: "hhk" },
  { name: "🔫 MP5", value: "mp5" },
  { name: "🔫 G36", value: "g36" },
  { name: "🔫 C4", value: "c4" }
];

function getTipoItem(item) {
  if (itensArmas.includes(item)) return "arma";
  if (itensGerais.includes(item)) return "geral";
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bau-entrada")
    .setDescription("Adicionar até 3 itens no baú da gerência")
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

    if (interaction.channel.id !== canais.entradaBauGerencia) {
      return interaction.reply({ content: "❌ Use este comando no canal entrada-bau da gerência.", flags: 64 });
    }

    const pares = [
      { item: interaction.options.getString("item1"), quantidade: interaction.options.getInteger("quantidade1") },
      { item: interaction.options.getString("item2"), quantidade: interaction.options.getInteger("quantidade2") },
      { item: interaction.options.getString("item3"), quantidade: interaction.options.getInteger("quantidade3") }
    ].filter(p => p.item && p.quantidade);

    if (!pares.length) {
      return interaction.reply({ content: "❌ Informe pelo menos um item com quantidade.", flags: 64 });
    }

    const itensUsados = new Set();

    for (const par of pares) {
      if (itensUsados.has(par.item)) {
        return interaction.reply({ content: `❌ O item **${par.item}** foi repetido no mesmo comando.`, flags: 64 });
      }

      itensUsados.add(par.item);

      const tipo = getTipoItem(par.item);
      if (!tipo) {
        return interaction.reply({ content: `❌ O item **${par.item}** é inválido.`, flags: 64 });
      }
    }

    const resposta = [];

    for (const par of pares) {
      const tipo = getTipoItem(par.item);
      let estoque = await ControleBau.findOne({ item: `gerencia_${par.item}` });

      if (!estoque) {
        estoque = new ControleBau({
          item: `gerencia_${par.item}`,
          quantidade: par.quantidade,
          tipo
        });
      } else {
        estoque.quantidade += par.quantidade;
      }

      await estoque.save();
      resposta.push(`• ${par.quantidade}x ${par.item}`);
    }

    return interaction.reply({
      content: `✅ Itens adicionados no baú da gerência:\n${resposta.join("\n")}`,
      flags: 64
    });
  }
};