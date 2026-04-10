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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("liberar-item")
    .setDescription("Libera um item no controle de baú")
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
        .setDescription("Quantidade")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const item = interaction.options.getString("item");
    const quantidade = interaction.options.getInteger("quantidade");

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

    if (quantidade <= 0) {
      return interaction.reply({
        content: "❌ A quantidade precisa ser maior que 0.",
        ephemeral: true
      });
    }

    let tipo = null;
    if (itensGerais.includes(item)) tipo = "geral";
    if (itensArmas.includes(item)) tipo = "arma";

    if (!tipo) {
      return interaction.reply({
        content: "❌ Item inválido.",
        ephemeral: true
      });
    }

    let registro = await ControleBau.findOne({ item });

    if (!registro) {
      registro = new ControleBau({
        item,
        quantidade,
        tipo
      });
    } else {
      registro.quantidade += quantidade;
    }

    await registro.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.tag,
      cargo: "Gerência",
      acao: "liberou",
      item,
      quantidade,
      tipo,
      canalId: interaction.channel.id,
      canalNome: interaction.channel.name
    });

    await logBau(client, {
      username: interaction.user.tag,
      cargo: "Gerência",
      acao: "Liberou",
      item,
      quantidade,
      tipo,
      canalNome: interaction.channel.name
    });

    return interaction.reply(`✅ ${quantidade}x ${item} foi liberado no controle de baú.`);
  }
};
