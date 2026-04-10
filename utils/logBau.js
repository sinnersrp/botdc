const { EmbedBuilder } = require("discord.js");
const { canais } = require("../config/config");

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

function formatarTipo(tipo = "") {
  if (tipo === "arma") return "Arma / Munição";
  if (tipo === "geral") return "Produto Geral";
  return "Não informado";
}

function getAcaoConfig(acao = "") {
  const normalizada = String(acao).toLowerCase();

  if (normalizada.includes("liber")) {
    return { titulo: "✅ Item liberado", cor: 0x57f287, emoji: "✅" };
  }

  if (normalizada.includes("retir")) {
    return { titulo: "📤 Item retirado", cor: 0xed4245, emoji: "📤" };
  }

  if (normalizada.includes("devolv")) {
    return { titulo: "📥 Item devolvido", cor: 0x5865f2, emoji: "📥" };
  }

  if (normalizada.includes("entrad")) {
    return { titulo: "📥 Entrada registrada", cor: 0x57f287, emoji: "📥" };
  }

  if (normalizada.includes("saíd") || normalizada.includes("saida")) {
    return { titulo: "📤 Saída registrada", cor: 0xed4245, emoji: "📤" };
  }

  return {
    titulo: "📋 Movimentação no baú",
    cor: 0x2b2d31,
    emoji: "📋"
  };
}

async function logBau(client, dados = {}) {
  try {
    const canal = await client.channels.fetch(canais.log).catch(() => null);
    if (!canal) return;

    const {
      username = "Desconhecido",
      cargo = "Não informado",
      acao = "Movimentação",
      item = "Não informado",
      quantidade = 0,
      tipo = "Não informado",
      canalNome = "Não informado"
    } = dados;

    const config = getAcaoConfig(acao);

    const embed = new EmbedBuilder()
      .setColor(config.cor)
      .setTitle(`${config.emoji} ${config.titulo}`)
      .addFields(
        { name: "👤 Usuário", value: `**${username}**`, inline: true },
        { name: "🏷️ Cargo", value: `**${cargo}**`, inline: true },
        { name: "📌 Ação", value: `**${acao}**`, inline: true },
        { name: "📦 Item", value: `**${formatarNomeItem(item)}**`, inline: true },
        { name: "🔢 Quantidade", value: `**${quantidade}**`, inline: true },
        { name: "🧩 Categoria", value: `**${formatarTipo(tipo)}**`, inline: true },
        { name: "💬 Canal", value: `**#${canalNome}**`, inline: false }
      )
      .setFooter({
        text: "SINNERS BOT • Log de movimentação"
      })
      .setTimestamp();

    await canal.send({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao enviar log do baú:", error);
  }
}

module.exports = logBau;