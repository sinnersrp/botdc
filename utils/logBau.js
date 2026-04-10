const { canais } = require("../config/config");

async function logBau(client, dados) {
  try {
    const canal = await client.channels.fetch(canais.log);
    if (!canal) return;

    await canal.send(
      `📦 **LOG CONTROLE DE BAÚ**
👤 Usuário: ${dados.username}
🛡 Cargo: ${dados.cargo}
📌 Ação: ${dados.acao}
📍 Tipo: ${dados.tipo}
📦 Item: ${dados.item}
🔢 Quantidade: ${dados.quantidade}
📝 Canal: ${dados.canalNome}`
    );
  } catch (error) {
    console.error("Erro ao enviar log:", error);
  }
}

module.exports = logBau;