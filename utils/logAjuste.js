const { EmbedBuilder } = require("discord.js");
const { canais } = require("../config/config");

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function formatarNomeItem(item = "") {
  const mapa = {
    maconha: "Maconha",
    metafetamina: "Metafetamina",
    cocaina: "Cocaína",
    attachs: "Attachs",
    colete: "Colete",
    algema: "Algema",
    envelope: "Envelope",
    lockpick: "Lockpick",
    "chip ilegal": "Chip Ilegal",
    adrenalina: "Adrenalina",
    bandagem: "Bandagem",
    hacking: "Hacking",
    capuz: "Capuz",
    "muni pt": "Muni PT",
    "muni sub": "Muni SUB",
    "muni de refle": "Muni de Refle",
    sub: "SUB",
    fiveseven: "FiveSeven",
    hhk: "HHK",
    c4: "C4",
    mp5: "MP5",
    g36: "G36"
  };

  return mapa[item] || item || "Não informado";
}

async function logAjuste(client, dados = {}) {
  try {
    const canal = await client.channels.fetch(canais.log).catch(() => null);
    if (!canal) return;

    const {
      tipo = "Ajuste manual",
      responsavel = "Desconhecido",
      alvo = "Não informado",
      acao = "Não informada",
      valor = null,
      item = null,
      estoque = null,
      quantidade = null,
      motivo = "Não informado"
    } = dados;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🛠️ Ajuste manual da gerência")
      .addFields(
        {
          name: "📌 Tipo",
          value: `**${tipo}**`,
          inline: true
        },
        {
          name: "👤 Responsável",
          value: `**${responsavel}**`,
          inline: true
        },
        {
          name: "🎯 Alvo",
          value: `**${alvo}**`,
          inline: true
        },
        {
          name: "⚙️ Ação",
          value: `**${acao}**`,
          inline: true
        }
      )
      .setFooter({
        text: "SINNERS BOT • Ajuste manual"
      })
      .setTimestamp();

    if (valor !== null) {
      embed.addFields({
        name: "💰 Valor",
        value: `**${formatMoney(valor)}**`,
        inline: true
      });
    }

    if (item !== null) {
      embed.addFields({
        name: "📦 Item",
        value: `**${formatarNomeItem(item)}**`,
        inline: true
      });
    }

    if (estoque !== null) {
      embed.addFields({
        name: "🏷️ Estoque",
        value: `**${estoque}**`,
        inline: true
      });
    }

    if (quantidade !== null) {
      embed.addFields({
        name: "🔢 Quantidade",
        value: `**${quantidade}**`,
        inline: true
      });
    }

    embed.addFields({
      name: "📝 Motivo",
      value: `**${motivo}**`,
      inline: false
    });

    await canal.send({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao enviar log de ajuste:", error);
  }
}

module.exports = logAjuste;