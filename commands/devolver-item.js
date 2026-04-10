const { SlashCommandBuilder } = require("discord.js");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const { canais, itensGerais, itensArmas } = require("../config/config");
const { isMembro } = require("../utils/permissoes");
const logBau = require("../utils/logBau");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("devolver-item")
    .setDescription("Devolver item ao controle de baú")
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
        content: "❌ Você não tem permissão para devolver itens.",
        ephemeral: true
      });
    }

    if (interaction.channel.id !== canais.entrada) {
      return interaction.reply({
        content: "❌ Use este comando no canal de entrada do controle de baú.",
        ephemeral: true
      });
    }

    if (quantidade <= 0) {
      return interaction.reply({
        content: "❌ A quantidade precisa ser maior que 0.",
        ephemeral: true
      });
    }

    let tipo = "geral";
    if (itensArmas.includes(item)) tipo = "arma";
    if (!itensGerais.includes(item) && !itensArmas.includes(item)) {
      return interaction.reply({
        content: "❌ Item inválido.",
        ephemeral: true
      });
    }

    let estoque = await ControleBau.findOne({ item });

    if (!estoque) {
      estoque = new ControleBau({
        item,
        quantidade,
        tipo
      });
    } else {
      estoque.quantidade += quantidade;
    }

    await estoque.save();

    await MovimentacaoBau.create({
      userId: interaction.user.id,
      username: interaction.user.tag,
      cargo: "Membro",
      acao: "devolveu",
      item,
      quantidade,
      tipo: estoque.tipo,
      canalId: interaction.channel.id,
      canalNome: interaction.channel.name
    });

    await logBau(client, {
      username: interaction.user.tag,
      cargo: "Membro",
      acao: "Devolveu",
      item,
      quantidade,
      tipo: estoque.tipo,
      canalNome: interaction.channel.name
    });

    return interaction.reply(`🔁 Você devolveu ${quantidade}x ${item}.`);
  }
};