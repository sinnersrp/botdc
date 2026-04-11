const { EmbedBuilder } = require("discord.js");
const FarmRegistro = require("../models/FarmRegistro");
const { canais, cargosLiberacao, cargoMembroPadrao } = require("../config/config");
const getSemanaRP = require("../utils/semanaRP");

const META_SEMANAL = 100000;

let ultimaChaveAviso24h = null;
let ultimaChaveFechamento = null;

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function escolherMensagem(lista = []) {
  if (!lista.length) return "";
  return lista[Math.floor(Math.random() * lista.length)];
}

function limparNomeCanal(nome = "") {
  return String(nome)
    .replace(/^arquivado-/, "")
    .replace(/^💸┃/, "")
    .replace(/┃/g, " | ")
    .replace(/-/g, " ")
    .trim();
}

function getCargoLabel(member) {
  if (!member) return "membro";

  const isGerencia = cargosLiberacao.some((roleId) =>
    member.roles.cache.has(roleId)
  );

  if (isGerencia) return "gerente/lider";
  if (member.roles.cache.has(cargoMembroPadrao)) return "membro";

  return "membro";
}

function getNowParts() {
  const now = new Date();

  return {
    now,
    year: now.getFullYear(),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
    weekday: now.getDay(),
    hour: now.getHours(),
    minute: now.getMinutes()
  };
}

function getMensagemParabens() {
  return escolherMensagem([
    "Parabéns, você atingiu a meta da semana. Continue com esse esforço e não pare nunca.",
    "Excelente trabalho. Você bateu a meta da semana e mostrou sua força para a família.",
    "Meta concluída com sucesso. Continue firme, seu esforço faz diferença.",
    "Você alcançou a meta da semana. Continue nesse ritmo forte e constante.",
    "Mais uma meta batida. Continue evoluindo e mantendo esse foco."
  ]);
}

function getMensagemSuperacao() {
  return escolherMensagem([
    "Dessa vez a meta não foi batida, mas a próxima semana pode ser melhor. Continue firme.",
    "Nem toda semana sai perfeita. O importante é não desistir e voltar mais forte.",
    "Continue em frente. Superação também faz parte do processo.",
    "Não desanima. Cada semana é uma nova chance para mostrar seu esforço.",
    "Use essa semana como motivação para voltar ainda mais forte na próxima."
  ]);
}

function getMensagemAviso24h(total) {
  const falta = Math.max(0, META_SEMANAL - total);

  if (total >= META_SEMANAL) {
    return escolherMensagem([
      `Faltam 24h para o fechamento da meta. Você já bateu sua meta com **${formatMoney(total)}**. Continue assim.`,
      `Faltam 24h para o fechamento. Sua meta já foi concluída com **${formatMoney(total)}**. Bom trabalho.`,
      `Restam 24h para fechar a semana e você já atingiu a meta com **${formatMoney(total)}**. Continue firme.`
    ]);
  }

  return escolherMensagem([
    `Faltam 24h para o fechamento da meta. Você está com **${formatMoney(total)}** e faltam **${formatMoney(falta)}**.`,
    `Aviso de 24h: você entregou **${formatMoney(total)}** até agora e ainda faltam **${formatMoney(falta)}** para a meta.`,
    `Restam 24h para encerrar a semana. Seu total atual é **${formatMoney(total)}** e faltam **${formatMoney(falta)}**.`
  ]);
}

async function buscarGuildPrincipal(client) {
  const guildId = process.env.GUILD_ID;
  if (guildId) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (guild) return guild;
  }

  return client.guilds.cache.first() || null;
}

async function buscarCanaisFarm(guild) {
  await guild.channels.fetch().catch(() => null);

  return guild.channels.cache
    .filter(
      (channel) =>
        channel.parentId === canais.categoriaFarmPrivado &&
        channel.topic &&
        channel.topic.startsWith("farm:")
    )
    .map((channel) => channel);
}

async function montarResumoSemana(guild, semanaId) {
  const registros = await FarmRegistro.find({ semanaId }).sort({ registradoEm: 1 });

  const totaisMap = new Map();

  for (const registro of registros) {
    const atual = totaisMap.get(registro.userId) || 0;
    totaisMap.set(registro.userId, atual + (Number(registro.valor) || 0));
  }

  const canaisFarm = await buscarCanaisFarm(guild);
  const membros = [];

  for (const canal of canaisFarm) {
    const userId = canal.topic.replace("farm:", "").trim();
    const total = totaisMap.get(userId) || 0;

    const member = await guild.members.fetch(userId).catch(() => null);
    const nome = member?.displayName || limparNomeCanal(canal.name);
    const cargo = getCargoLabel(member);

    membros.push({
      userId,
      nome,
      cargo,
      total,
      canal
    });
  }

  const entregaram = membros.filter((m) => m.total > 0);
  const naoEntregaram = membros.filter((m) => m.total <= 0);

  return {
    membros,
    entregaram,
    naoEntregaram
  };
}

function chunkLines(lines = [], maxChars = 3800) {
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function criarEmbedAviso24hGeral(semanaId, entregaram, naoEntregaram) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("⏰ Aviso de 24 horas para o fechamento")
    .setDescription("Faltam **24 horas** para o fechamento do farm semanal.")
    .addFields(
      {
        name: "🗓️ Semana",
        value: `**${semanaId}**`,
        inline: false
      },
      {
        name: "✅ Já entregaram",
        value: `**${entregaram.length}**`,
        inline: true
      },
      {
        name: "❌ Pendentes",
        value: `**${naoEntregaram.length}**`,
        inline: true
      }
    )
    .setFooter({
      text: "SINNERS BOT • Aviso automático"
    })
    .setTimestamp();
}

function criarEmbedAviso24hIndividual(membro) {
  const falta = Math.max(0, META_SEMANAL - membro.total);
  const bateu = membro.total >= META_SEMANAL;

  return new EmbedBuilder()
    .setColor(bateu ? 0x57f287 : 0xf1c40f)
    .setTitle("⏰ Faltam 24 horas para o fechamento")
    .setDescription(getMensagemAviso24h(membro.total))
    .addFields(
      {
        name: "📊 Total atual",
        value: `**${formatMoney(membro.total)}**`,
        inline: true
      },
      {
        name: "🎯 Meta",
        value: `**${formatMoney(META_SEMANAL)}**`,
        inline: true
      },
      {
        name: "❌ Falta para meta",
        value: `**${formatMoney(falta)}**`,
        inline: true
      },
      {
        name: "🕘 Prazo final",
        value: "**amanhã às 21:59**",
        inline: false
      }
    )
    .setFooter({
      text: "SINNERS BOT • Aviso individual"
    })
    .setTimestamp();
}

function criarEmbedFinalMembro(membro) {
  const excedente = Math.max(0, membro.total - META_SEMANAL);
  const limpo = Math.floor(excedente * 0.5);
  const bateuMeta = membro.total >= META_SEMANAL;

  if (bateuMeta) {
    return new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("🎉 Fechamento da semana")
      .setDescription(getMensagemParabens())
      .addFields(
        {
          name: "📊 Total entregue",
          value: `**${formatMoney(membro.total)}**`,
          inline: true
        },
        {
          name: "🎯 Meta",
          value: `**${formatMoney(META_SEMANAL)}**`,
          inline: true
        },
        {
          name: "📈 Excedente",
          value: `**${formatMoney(excedente)}**`,
          inline: true
        },
        {
          name: "💵 Valor limpo",
          value: `**${formatMoney(limpo)}**`,
          inline: false
        }
      )
      .setFooter({
        text: "SINNERS BOT • Resultado semanal"
      })
      .setTimestamp();
  }

  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("💪 Fechamento da semana")
    .setDescription(getMensagemSuperacao())
    .addFields(
      {
        name: "📊 Total entregue",
        value: `**${formatMoney(membro.total)}**`,
        inline: true
      },
      {
        name: "🎯 Meta",
        value: `**${formatMoney(META_SEMANAL)}**`,
        inline: true
      },
      {
        name: "❌ Faltou para meta",
        value: `**${formatMoney(Math.max(0, META_SEMANAL - membro.total))}**`,
        inline: true
      }
    )
    .setFooter({
      text: "SINNERS BOT • Resultado semanal"
    })
    .setTimestamp();
}

function criarEmbedsRelatorioFinal(semanaId, entregaram, naoEntregaram) {
  const familiaTotal = entregaram.reduce((acc, membro) => {
    return acc + Math.min(membro.total, META_SEMANAL);
  }, 0);

  const excedenteTotal = entregaram.reduce((acc, membro) => {
    return acc + Math.max(0, membro.total - META_SEMANAL);
  }, 0);

  const limpoTotal = Math.floor(excedenteTotal * 0.5);

  const resumoEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📋 Relatório final do farm semanal")
    .addFields(
      {
        name: "🗓️ Semana",
        value: `**${semanaId}**`,
        inline: false
      },
      {
        name: "✅ Entregaram",
        value: `**${entregaram.length}**`,
        inline: true
      },
      {
        name: "❌ Não entregaram",
        value: `**${naoEntregaram.length}**`,
        inline: true
      },
      {
        name: "🏦 Total família",
        value: `**${formatMoney(familiaTotal)}**`,
        inline: true
      },
      {
        name: "📈 Excedente total",
        value: `**${formatMoney(excedenteTotal)}**`,
        inline: true
      },
      {
        name: "💵 Limpo total",
        value: `**${formatMoney(limpoTotal)}**`,
        inline: true
      }
    )
    .setFooter({
      text: "SINNERS BOT • Relatório semanal"
    })
    .setTimestamp();

  const detalhesEntregaram = [];
  for (const membro of entregaram) {
    const familia = Math.min(membro.total, META_SEMANAL);
    const excedente = Math.max(0, membro.total - META_SEMANAL);
    const limpo = Math.floor(excedente * 0.5);

    detalhesEntregaram.push(`**${membro.nome}** | ${membro.cargo}`);
    detalhesEntregaram.push(`Total: ${formatMoney(membro.total)}`);
    detalhesEntregaram.push(`Família: ${formatMoney(familia)}`);
    detalhesEntregaram.push(`Excedente: ${formatMoney(excedente)}`);
    detalhesEntregaram.push(`Limpo: ${formatMoney(limpo)}`);
    detalhesEntregaram.push("");
  }

  const detalhesNaoEntregaram = naoEntregaram.map(
    (membro) => `• ${membro.nome} | ${membro.cargo}`
  );

  const embeds = [resumoEmbed];

  if (detalhesEntregaram.length) {
    const entregaramChunks = chunkLines(detalhesEntregaram);
    for (let i = 0; i < entregaramChunks.length; i++) {
      embeds.push(
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(i === 0 ? "✅ Entregaram" : "✅ Entregaram (continuação)")
          .setDescription(entregaramChunks[i])
      );
    }
  } else {
    embeds.push(
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Entregaram")
        .setDescription("Ninguém entregou nesta semana.")
    );
  }

  if (detalhesNaoEntregaram.length) {
    const naoChunks = chunkLines(detalhesNaoEntregaram);
    for (let i = 0; i < naoChunks.length; i++) {
      embeds.push(
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle(i === 0 ? "❌ Não entregaram" : "❌ Não entregaram (continuação)")
          .setDescription(naoChunks[i])
      );
    }
  } else {
    embeds.push(
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("❌ Não entregaram")
        .setDescription("Todos entregaram nesta semana.")
    );
  }

  return embeds;
}

async function enviarAviso24hGeral(client, semanaId, entregaram, naoEntregaram) {
  const canal = await client.channels.fetch(canais.metaSemanal).catch(() => null);
  if (!canal) return;

  await canal.send({
    embeds: [criarEmbedAviso24hGeral(semanaId, entregaram, naoEntregaram)]
  });
}

async function enviarAviso24hIndividual(resumo) {
  for (const membro of resumo.membros) {
    await membro.canal.send({
      embeds: [criarEmbedAviso24hIndividual(membro)]
    }).catch(() => null);
  }
}

async function enviarMensagensFinaisIndividuais(resumo) {
  for (const membro of resumo.membros) {
    await membro.canal.send({
      embeds: [criarEmbedFinalMembro(membro)]
    }).catch(() => null);
  }
}

async function enviarRelatorioFinalGerencia(client, semanaId, entregaram, naoEntregaram) {
  const canal = await client.channels.fetch(canais.chatGerencia).catch(() => null);
  if (!canal) return;

  const embeds = criarEmbedsRelatorioFinal(semanaId, entregaram, naoEntregaram);

  for (const embed of embeds) {
    await canal.send({ embeds: [embed] });
  }
}

async function processarAviso24h(client) {
  const guild = await buscarGuildPrincipal(client);
  if (!guild) return;

  const { semanaId } = getSemanaRP();
  const resumo = await montarResumoSemana(guild, semanaId);

  await enviarAviso24hGeral(client, semanaId, resumo.entregaram, resumo.naoEntregaram);
  await enviarAviso24hIndividual(resumo);
}

async function processarFechamento(client) {
  const guild = await buscarGuildPrincipal(client);
  if (!guild) return;

  const { semanaId } = getSemanaRP();
  const resumo = await montarResumoSemana(guild, semanaId);

  await enviarRelatorioFinalGerencia(
    client,
    semanaId,
    resumo.entregaram,
    resumo.naoEntregaram
  );

  await enviarMensagensFinaisIndividuais(resumo);
}

function iniciarFarmScheduler(client) {
  console.log("✅ Scheduler do farm iniciado.");

  setInterval(async () => {
    try {
      const { year, month, day, weekday, hour, minute } = getNowParts();
      const chaveDia = `${year}-${month}-${day}`;

      const ehAviso24h = weekday === 4 && hour === 21 && minute === 59;
      const ehFechamento = weekday === 5 && hour === 21 && minute === 59;

      if (ehAviso24h && ultimaChaveAviso24h !== chaveDia) {
        ultimaChaveAviso24h = chaveDia;
        await processarAviso24h(client);
      }

      if (ehFechamento && ultimaChaveFechamento !== chaveDia) {
        ultimaChaveFechamento = chaveDia;
        await processarFechamento(client);
      }
    } catch (error) {
      console.error("Erro no scheduler do farm:", error);
    }
  }, 60 * 1000);
}

module.exports = {
  iniciarFarmScheduler
};