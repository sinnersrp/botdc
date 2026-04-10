const { EmbedBuilder } = require("discord.js");
const { canais } = require("../config/config");

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function getStatusInfo(total) {
  const meta = 100000;

  if (total >= meta) {
    return {
      texto: "✅ Meta batida",
      cor: 0x57f287
    };
  }

  return {
    texto: `❌ Faltam ${formatMoney(meta - total)}`,
    cor: 0xed4245
  };
}

async function logFarm(client, dados = {}) {
  try {
    const canal = await client.channels.fetch(canais.logFarm).catch(() => null);
    if (!canal) return;

    const {
      username = "Desconhecido",
      userId = "",
      valor = 0,
      totalSemana = 0,
      semanaId = "Não informada",
      comprovante = "",
      canalNome = "Não informado"
    } = dados;

    const status = getStatusInfo(totalSemana);

    const embed = new EmbedBuilder()
      .setColor(status.cor)
      .setTitle("💸 Registro de farm")
      .addFields(
        {
          name: "👤 Usuário",
          value: userId ? `**${username}**\n<@${userId}>` : `**${username}**`,
          inline: true
        },
        {
          name: "💰 Valor enviado",
          value: `**${formatMoney(valor)}**`,
          inline: true
        },
        {
          name: "📊 Total na semana",
          value: `**${formatMoney(totalSemana)}**`,
          inline: true
        },
        {
          name: "🎯 Status",
          value: `**${status.texto}**`,
          inline: false
        },
        {
          name: "🗓️ Semana",
          value: `**${semanaId}**`,
          inline: false
        },
        {
          name: "💬 Canal",
          value: `**#${canalNome}**`,
          inline: false
        }
      )
      .setFooter({
        text: "SINNERS BOT • Log de farm"
      })
      .setTimestamp();

    if (comprovante) {
      embed.addFields({
        name: "🧾 Comprovante",
        value: comprovante,
        inline: false
      });

      if (
        comprovante.startsWith("http://") ||
        comprovante.startsWith("https://")
      ) {
        embed.setImage(comprovante);
      }
    }

    await canal.send({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao enviar log de farm:", error);
  }
}

module.exports = logFarm;