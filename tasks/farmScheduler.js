const cron = require("node-cron");
const FarmRegistro = require("../models/FarmRegistro");
const BotAgendaState = require("../models/BotAgendaState");
const { canais, cargosLiberacao, cargosMembro } = require("../config/config");
const getSemanaRP = require("../utils/semanaRP");

const META_SEMANAL = 100000;

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function getCargo(member) {
  if (cargosLiberacao.some((id) => member.roles.cache.has(id))) {
    return "gerente/lider";
  }

  if (cargosMembro.some((id) => member.roles.cache.has(id))) {
    return "membro";
  }

  return null;
}

function calcularResumo(total) {
  const valorFamilia = Math.min(total, META_SEMANAL);
  const excedente = Math.max(total - META_SEMANAL, 0);
  const valorLimpo = Math.floor(excedente * 0.5);
  const faltante = Math.max(META_SEMANAL - total, 0);

  return {
    valorFamilia,
    excedente,
    valorLimpo,
    faltante,
    bateuMeta: total >= META_SEMANAL
  };
}

async function jaFoiEnviado(key) {
  const existe = await BotAgendaState.findOne({ key });
  return !!existe;
}

async function marcarComoEnviado(key) {
  await BotAgendaState.findOneAndUpdate(
    { key },
    { key, sentAt: new Date() },
    { upsert: true, new: true }
  );
}

function dividirLista(lista, tamanho = 25) {
  const blocos = [];
  for (let i = 0; i < lista.length; i += tamanho) {
    blocos.push(lista.slice(i, i + tamanho));
  }
  return blocos;
}

async function getParticipantes(guild) {
  await guild.members.fetch();

  return guild.members.cache.filter((member) => {
    if (member.user.bot) return false;
    return !!getCargo(member);
  });
}

async function enviarAviso24h(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const canal = guild.channels.cache.get(canais.metaSemanal);
  if (!canal) return;

  const semana = getSemanaRP();
  const registros = await FarmRegistro.find({
    semanaId: semana.semanaId
  });

  const entregaramIds = new Set(registros.map((r) => r.userId));
  const participantes = await getParticipantes(guild);

  const faltando = [];

  for (const [, member] of participantes) {
    if (!entregaramIds.has(member.id)) {
      faltando.push(`• ${member.displayName}`);
    }
  }

  const mensagem = [
    "🚨 **AVISO DE FARM SEMANAL**",
    "",
    "Faltam **24 horas** para o fechamento do farm semanal.",
    "⏰ **Prazo final:** sexta-feira às 21:59",
    "🕙 **Nova semana começa:** sexta-feira às 22:00",
    "",
    `❌ **Pendentes até agora:** ${faltando.length}`
  ].join("\n");

  await canal.send({ content: mensagem });

  if (faltando.length > 0) {
    const blocos = dividirLista(faltando, 30);
    for (const bloco of blocos) {
      await canal.send({ content: bloco.join("\n") });
    }
  }
}

async function enviarRelatorioFinal(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const canal = guild.channels.cache.get(canais.chatGerencia);
  if (!canal) return;

  // Na sexta 22:00, a semana atual já virou.
  // Então pegamos 1 minuto antes para buscar a semana que acabou.
  const referencia = new Date();
  referencia.setMinutes(referencia.getMinutes() - 1);

  const semana = getSemanaRP(referencia);

  const registros = await FarmRegistro.find({
    semanaId: semana.semanaId
  }).sort({ registradoEm: -1 });

  const mapa = new Map();

  for (const registro of registros) {
    const atual = mapa.get(registro.userId) || {
      userId: registro.userId,
      username: registro.username,
      cargo: registro.cargo,
      total: 0
    };

    atual.total += registro.valor || 0;
    atual.username = registro.username || atual.username;
    atual.cargo = registro.cargo || atual.cargo;

    mapa.set(registro.userId, atual);
  }

  const participantes = await getParticipantes(guild);

  const entregaram = [];
  const naoEntregaram = [];

  for (const [, member] of participantes) {
    const cargoDiscord = getCargo(member);
    const registro = mapa.get(member.id);

    if (registro) {
      const resumo = calcularResumo(registro.total);

      entregaram.push(
        [
          `• ${member.displayName} | ${cargoDiscord}`,
          `  Total: ${formatMoney(registro.total)}`,
          `  Família: ${formatMoney(resumo.valorFamilia)}`,
          `  Excedente: ${formatMoney(resumo.excedente)}`,
          `  Limpo: ${formatMoney(resumo.valorLimpo)}`
        ].join("\n")
      );
    } else {
      naoEntregaram.push(`• ${member.displayName} | ${cargoDiscord}`);
    }
  }

  await canal.send({
    content: [
      "📋 **RELATÓRIO FINAL DO FARM SEMANAL**",
      "",
      `🗓️ **Semana:** ${semana.semanaId}`,
      `✅ **Entregaram:** ${entregaram.length}`,
      `❌ **Não entregaram:** ${naoEntregaram.length}`
    ].join("\n")
  });

  if (entregaram.length > 0) {
    const blocosEntregaram = dividirLista(entregaram, 10);
    for (let i = 0; i < blocosEntregaram.length; i++) {
      await canal.send({
        content:
          i === 0
            ? `✅ **ENTREGARAM:**\n${blocosEntregaram[i].join("\n\n")}`
            : blocosEntregaram[i].join("\n\n")
      });
    }
  } else {
    await canal.send({
      content: "✅ **ENTREGARAM:**\nNinguém entregou nesta semana."
    });
  }

  if (naoEntregaram.length > 0) {
    const blocosNao = dividirLista(naoEntregaram, 25);
    for (let i = 0; i < blocosNao.length; i++) {
      await canal.send({
        content:
          i === 0
            ? `❌ **NÃO ENTREGARAM:**\n${blocosNao[i].join("\n")}`
            : blocosNao[i].join("\n")
      });
    }
  } else {
    await canal.send({ content: "❌ **NÃO ENTREGARAM:**\nTodos entregaram." });
  }
}

function iniciarFarmScheduler(client) {
  cron.schedule(
    "0 22 * * 4",
    async () => {
      try {
        const semana = getSemanaRP();
        const key = `farm-aviso-${semana.semanaId}`;

        if (await jaFoiEnviado(key)) return;

        await enviarAviso24h(client);
        await marcarComoEnviado(key);

        console.log("✅ Aviso 24h do farm enviado.");
      } catch (error) {
        console.error("❌ Erro no aviso 24h do farm:", error);
      }
    },
    {
      timezone: "America/Sao_Paulo"
    }
  );

  cron.schedule(
    "0 22 * * 5",
    async () => {
      try {
        const referencia = new Date();
        referencia.setMinutes(referencia.getMinutes() - 1);

        const semana = getSemanaRP(referencia);
        const key = `farm-relatorio-${semana.semanaId}`;

        if (await jaFoiEnviado(key)) return;

        await enviarRelatorioFinal(client);
        await marcarComoEnviado(key);

        console.log("✅ Relatório final do farm enviado.");
      } catch (error) {
        console.error("❌ Erro no relatório final do farm:", error);
      }
    },
    {
      timezone: "America/Sao_Paulo"
    }
  );

  console.log("✅ Scheduler do farm iniciado.");
}

module.exports = {
  iniciarFarmScheduler
};
