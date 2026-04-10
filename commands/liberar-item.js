const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const { canais, itensGerais, itensArmas } = require("../config/config");
const { isGerenteOuLider } = require("../utils/permissoes");
const logBau = require("../utils/logBau");

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

function getTipoItem(item) {
  if (itensGerais.includes(item)) return "geral";
  if (itensArmas.includes(item)) return "arma";
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("liberar-item")
    .setDescription("Libera até 3 itens no controle de baú")
    .addStringOption(option =>
      option
        .setName("item1")
        .setDescription("Primeiro item")
        .setRequired(true)
        .addChoices(...opcoesItens)
    )
    .addIntegerOption(option =>
      option
        .setName("quantidade1")
        .setDescription("Quantidade do primeiro item")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName("item2")
        .setDescription("Segundo item")
        .setRequired(false)
        .addChoices(...opcoesItens)
    )
    .addIntegerOption(option =>
      option
        .setName("quantidade2")
        .setDescription("Quantidade do segundo item")
        .setRequired(false)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName("item3")
        .setDescription("Terceiro item")
        .setRequired(false)
        .addChoices(...opcoesItens)
    )
    .addIntegerOption(option =>
      option
        .setName("quantidade3")
        .setDescription("Quantidade do terceiro item")
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas gerente ou líder pode liberar itens.",
        ephemeral: true
      });
    }

    if (interaction.channel.id !== canais.entrada) {
      return interaction.reply({
        content: "❌ Use no canal de entrada do controle de baú.",
        ephemeral: true
      });
    }

    const pares = [
      {
        item: interaction.options.getString("item1"),
        quantidade: interaction.options.getInteger("quantidade1")
      },
      {
        item: interaction.options.getString("item2"),
        quantidade: interaction.options.getInteger("quantidade2")
      },
      {
        item: interaction.options.getString("item3"),
        quantidade: interaction.options.getInteger("quantidade3")
      }
    ].filter(p => p.item && p.quantidade);

    if (!pares.length) {
      return interaction.reply({
        content: "❌ Informe pelo menos um item com quantidade.",
        ephemeral: true
      });
    }

    const itensDuplicados = new Set();
    for (const par of pares) {
      if (itensDuplicados.has(par.item)) {
        return interaction.reply({
          content: `❌ O item **${par.item}** foi repetido no mesmo comando.`,
          ephemeral: true
        });
      }
      itensDuplicados.add(par.item);

      const tipo = getTipoItem(par.item);
      if (!tipo) {
        return interaction.reply({
          content: `❌ O item **${par.item}** é inválido.`,
          ephemeral: true
        });
      }
    }

    const respostas = [];

    for (const par of pares) {
      const tipo = getTipoItem(par.item);

      let registro = await ControleBau.findOne({ item: par.item });

      if (!registro) {
        registro = new ControleBau({
          item: par.item,
          quantidade: par.quantidade,
          tipo
        });
      } else {
        registro.quantidade += par.quantidade;
      }

      await registro.save();

      await MovimentacaoBau.create({
        userId: interaction.user.id,
        username: interaction.user.tag,
        cargo: "Gerência",
        acao: "liberou",
        item: par.item,
        quantidade: par.quantidade,
        tipo,
        canalId: interaction.channel.id,
        canalNome: interaction.channel.name
      });

      await logBau(client, {
        username: interaction.user.tag,
        cargo: "Gerência",
        acao: "Liberou",
        item: par.item,
        quantidade: par.quantidade,
        tipo,
        canalNome: interaction.channel.name
      });

      respostas.push(`• ${par.quantidade}x ${par.item}`);
    }

    return interaction.reply({
      content: `✅ Itens liberados no controle de baú:\n${respostas.join("\n")}`
    });
  }
};