const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const { isGerenteOuLider } = require("../utils/permissoes");

function formatMoney(value) {
  const numero = Number(value) || 0;
  return new Intl.NumberFormat("pt-BR").format(numero);
}

function resumirTexto(texto = "", limite = 120) {
  const t = String(texto || "").replace(/\n/g, " ").trim();
  if (t.length <= limite) return t || "Sem informação";
  return `${t.slice(0, limite)}...`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ver-registros-farm")
    .setDescription("Mostra todos os registros de farm da semana de um membro")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Membro para consultar")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a gerência pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    const usuario = interaction.options.getUser("usuario", true);
    const semana = getSemanaRP();

    const registros = await FarmRegistro.find({
      userId: usuario.id,
      semanaId: semana.semanaId
    }).sort({ registradoEm: 1 });

    if (!registros.length) {
      return interaction.editReply({
        content: `❌ Nenhum registro encontrado para **${usuario.username}** na semana **${semana.semanaId}**.`
      });
    }

    const total = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

    const headerEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📋 Registros de farm da semana")
      .addFields(
        {
          name: "👤 Membro",
          value: `${usuario}\n**${usuario.username}**`,
          inline: false
        },
        {
          name: "🗓️ Semana",
          value: `**${semana.semanaId}**`,
          inline: true
        },
        {
          name: "🧾 Quantidade de registros",
          value: `**${registros.length}**`,
          inline: true
        },
        {
          name: "💰 Total atual",
          value: `**${formatMoney(total)}**`,
          inline: true
        }
      )
      .setFooter({
        text: "SINNERS BOT • Auditoria de farm"
      })
      .setTimestamp();

    const linhas = registros.map((registro, index) => {
      const data = registro.registradoEm
        ? new Date(registro.registradoEm).toLocaleString("pt-BR")
        : "Sem data";

      return [
        `**#${index + 1}**`,
        `ID: \`${registro._id}\``,
        `Valor: **${formatMoney(registro.valor)}**`,
        `Cargo: **${registro.cargo || "não informado"}**`,
        `Data: **${data}**`,
        `Comprovante/Obs: ${resumirTexto(registro.comprovante || "Sem comprovante")}`
      ].join("\n");
    });

    const embeds = [headerEmbed];
    let bloco = "";

    for (const linha of linhas) {
      const candidato = bloco ? `${bloco}\n\n${linha}` : linha;

      if (candidato.length > 3500) {
        embeds.push(
          new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle("🧾 Detalhes dos registros")
            .setDescription(bloco)
        );
        bloco = linha;
      } else {
        bloco = candidato;
      }
    }

    if (bloco) {
      embeds.push(
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("🧾 Detalhes dos registros")
          .setDescription(bloco)
      );
    }

    return interaction.editReply({
      embeds
    });
  }
};