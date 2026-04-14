const FORUM_COMANDO_BOT_ID = "1492991343948070922";

function isForumComandoBot(channel) {
  if (!channel) return false;
  return String(channel.id) === FORUM_COMANDO_BOT_ID;
}

function criarLinkCanal(guildId, channelId) {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

module.exports = {
  FORUM_COMANDO_BOT_ID,
  isForumComandoBot,
  criarLinkCanal
};