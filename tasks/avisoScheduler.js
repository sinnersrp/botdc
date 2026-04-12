const AvisoAgendado = require("../models/AvisoAgendado");
const {
  criarEmbedAviso,
  getAllowedMentions,
  getMencaoConteudo
} = require("../utils/painelAvisos");

async function processarAvisosAgendados(client) {
  try {
    const agora = new Date();

    const avisos = await AvisoAgendado.find({
      enviado: false,
      agendarPara: { $lte: agora }
    }).sort({ agendarPara: 1 });

    for (const aviso of avisos) {
      const canal = await client.channels.fetch(aviso.canalId).catch(() => null);
      if (!canal) continue;

      const conteudoMencao = getMencaoConteudo(aviso.mencaoTipo);

      await canal.send({
        content: conteudoMencao || undefined,
        embeds: [
          criarEmbedAviso({
            titulo: aviso.titulo,
            mensagem: aviso.mensagem,
            rodape: `SINNERS FAMILY • Aviso agendado por ${aviso.criadoPorTag}`
          })
        ],
        allowedMentions: getAllowedMentions(aviso.mencaoTipo)
      });

      aviso.enviado = true;
      aviso.enviadoEm = new Date();
      await aviso.save();
    }
  } catch (error) {
    console.error("Erro ao processar avisos agendados:", error);
  }
}

function iniciarAvisoScheduler(client) {
  console.log("✅ Scheduler de avisos iniciado.");

  setInterval(async () => {
    await processarAvisosAgendados(client);
  }, 60 * 1000);
}

module.exports = {
  iniciarAvisoScheduler
};