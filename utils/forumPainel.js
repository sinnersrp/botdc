const { ChannelType } = require("discord.js");
const { canais } = require("../config/config");

async function buscarThreadPorNome(forumChannel, threadName) {
  const ativos = await forumChannel.threads.fetchActive().catch(() => null);
  const ativa = ativos?.threads?.find((thread) => thread.name === threadName);
  if (ativa) return ativa;

  const arquivados = await forumChannel.threads.fetchArchived().catch(() => null);
  const arquivada = arquivados?.threads?.find((thread) => thread.name === threadName);
  if (arquivada) return arquivada;

  return null;
}

async function limparMensagensDoBot(thread) {
  try {
    const messages = await thread.messages.fetch({ limit: 30 }).catch(() => null);
    if (!messages) return;

    const paraApagar = messages.filter(
      (msg) => msg.author?.bot && msg.author.id === thread.client.user.id
    );

    for (const [, msg] of paraApagar) {
      await msg.delete().catch(() => null);
    }
  } catch (error) {
    console.error("Erro ao limpar mensagens antigas do painel:", error);
  }
}

async function enviarPainelNoForum(client, threadName, payload) {
  const forum = await client.channels.fetch(canais.forumComandoBot).catch(() => null);

  if (!forum) {
    throw new Error("Fórum de comando-bot não encontrado.");
  }

  if (forum.type !== ChannelType.GuildForum) {
    throw new Error("O canal configurado não é um fórum.");
  }

  let thread = await buscarThreadPorNome(forum, threadName);

  if (!thread) {
    thread = await forum.threads.create({
      name: threadName,
      message: payload,
      autoArchiveDuration: 10080,
      reason: `Criando painel ${threadName}`
    });

    return thread;
  }

  if (thread.archived) {
    await thread.setArchived(false).catch(() => null);
  }

  await limparMensagensDoBot(thread);
  await thread.send(payload);

  return thread;
}

module.exports = {
  enviarPainelNoForum
};