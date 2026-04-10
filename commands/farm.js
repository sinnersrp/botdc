const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const FarmRegistro = require("../models/FarmRegistro");
const { canais, cargosLiberacao, cargosMembro } = require("../config/config");
const getSemanaRP = require("../utils/semanaRP");

function isGerenteOuLider(member) {
  return cargosLiberacao.some((cargoId) => member.roles.cache.has(cargoId));
}

function isMembro(member) {
  return (
    cargosMembro.some((cargoId) => member.roles.cache.has(cargoId)) ||
    isGerenteOuLider(member)
  );
}

function descobrirCargoPrincipal(member) {
  if (isGerenteOuLider(member)) {
    const isLider =
      member.roles.cache.has("1480507564251942969") ||
      member.roles.cache.has("1480507564251942968") ||
      member.roles.cache.has("1480507564251942967");

    if (isLider) return "lider";
    return "gerente";
  }

  return "membro";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("farm")
    .setDescription("Registrar farm semanal com comprovante")
    .addIntegerOption((option) =>
      option
        .setName("valor")
        .setDescription("Valor do dinheiro sujo registrado")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("comprovante")
        .setDescription("Imagem do comprovante")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("observacao")
        .setDescription("Observação opcional")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const valor = interaction.options.getInteger("valor");
    const comprovante = interaction.options.getAttachment("comprovante");
    const observacao = interaction.options.getString("observacao") || "";

    if (!isMembro(interaction.member)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para registrar farm.",
        ephemeral: true
      });
    }

    if (!valor || valor <= 0) {
      return interaction.reply({
        content: "❌ O valor precisa ser maior que 0.",
        ephemeral: true
      });
    }

    if (!comprovante) {
      return interaction.reply({
        content: "❌ Você precisa enviar um comprovante.",
        ephemeral: true
      });
    }

    const tiposPermitidos = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp"
    ];

    if (!tiposPermitidos.includes(comprovante.contentType)) {
      return interaction.reply({
        content: "❌ O comprovante precisa ser uma imagem PNG, JPG, JPEG ou WEBP.",
        ephemeral: true
      });
    }

    const semana = getSemanaRP();
    const cargo = descobrirCargoPrincipal(interaction.member);

    const registro = await FarmRegistro.create({
      userId: interaction.user.id,
      username: interaction.user.tag,
      cargo,
      valor,
      semanaId: semana.semanaId,
      registradoEm: new Date(),
      origem: "bot",
      observacao,
      comprovanteUrl: comprovante.url,
      comprovanteNome: comprovante.name || "",
      canalId: interaction.channel.id,
      canalNome: interaction.channel.name
    });

    const canalTesteBot = await client.channels.fetch(canais.testeBot).catch(() => null);

    if (canalTesteBot) {
      const embed = new EmbedBuilder()
        .setTitle("💸 Novo registro de farm")
        .setDescription("Um novo farm foi registrado no sistema.")
        .addFields(
          { name: "Usuário", value: interaction.user.tag, inline: true },
          { name: "Cargo", value: cargo, inline: true },
          { name: "Valor", value: `R$ ${valor.toLocaleString("pt-BR")}`, inline: true },
          { name: "Canal", value: `#${interaction.channel.name}`, inline: true },
          { name: "Semana RP", value: semana.semanaId, inline: false },
          { name: "Observação", value: observacao || "Nenhuma", inline: false }
        )
        .setImage(comprovante.url)
        .setFooter({
          text: `Registro ID: ${registro._id}`
        })
        .setTimestamp();

      await canalTesteBot.send({ embeds: [embed] }).catch((error) => {
        console.error("Erro ao enviar farm para teste-bot:", error);
      });
    }

    return interaction.reply({
      content: `✅ Farm de **R$ ${valor.toLocaleString(
        "pt-BR"
      )}** registrado com comprovante com sucesso.`,
      ephemeral: true
    });
  }
};