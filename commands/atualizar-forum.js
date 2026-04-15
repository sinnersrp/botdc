const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { canais, canaisFarmMembros } = require("../config/config");

const { criarPainelRegistro } = require("../utils/registroMembro");
const { criarPainelBau } = require("../utils/painelBau");
const { criarPainelControleBau } = require("../utils/painelControleBau");
const { criarPainelAvisos } = require("../utils/painelAvisos");
const { criarPainelFarm } = require("../utils/painelFarm");

function criarPainelGerencia() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("🛠️ Painel da Gerência")
    .setDescription(
      [
        "Comandos úteis da gerência:",
        "",
        "• `/ver-caixa`",
        "• `/lavar-dinheiro`",
        "• `/historico-caixa`",
        "• `/ajuste-gerencia dinheiro-sujo`",
        "• `/ajuste-gerencia estoque`",
        "• `/remover-registro-farm`",
        "• `/atualizar-forum`"
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Gerência" })
    .setTimestamp();

  return { embeds: [embed] };
}

function getTitulosPainel() {
  return [
    "📝 Painel de Registro",
    "💸 Painel de Dinheiro Sujo",
    "📦 Painel do Baú da Gerência",
    "📦 Painel do Controle de Baú",
    "📢 Painel de Avisos",
    "🛠️ Painel da Gerência"
  ];
}

function mensagemEhPainelDoBot(message) {
  if (!message || !message.author || !message.author.bot) return false;
  if (!message.embeds || !message.embeds.length) return false;

  const titulos = getTitulosPainel();
  const titulo = String(message.embeds[0]?.title || "").trim();

  return titulos.includes(titulo);
}

async function limparPaineisAntigosDoCanal(channel) {
  if (!channel || !channel.isTextBased?.()) {
    return { apagadas: 0 };
  }

  let apagadas = 0;
  let ultimaMensagemId = undefined;
  let continuar = true;

  while (continuar) {
    const mensagens = await channel.messages.fetch({
      limit: 100,
      before: ultimaMensagemId
    });

    if (!mensagens.size) break;

    const paraApagar = mensagens.filter((msg) => mensagemEhPainelDoBot(msg));
    for (const [, msg] of paraApagar) {
      try {
        await msg.delete();
        apagadas++;
      } catch (_) {}
    }

    ultimaMensagemId = mensagens.last()?.id;
    continuar = mensagens.size === 100;
  }

  return { apagadas };
}

async function buscarCanal(guild, channelId) {
  if (!channelId) return null;
  return (
    guild.channels.cache.get(String(channelId)) ||
    await guild.channels.fetch(String(channelId)).catch(() => null)
  );
}

async function limparEEnviarPainel(channel, payload) {
  if (!channel) {
    return { ok: false, motivo: "Canal não encontrado", apagadas: 0 };
  }

  const { apagadas } = await limparPaineisAntigosDoCanal(channel);
  await channel.send(payload);

  return {
    ok: true,
    canal: channel.name,
    apagadas
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("atualizar-forum")
    .setDescription("Limpa painéis antigos do bot e reposta todos os painéis atualizados"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas 01, 02, 03 e gerente geral podem usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    const guild = interaction.guild;
    const resultados = [];

    const canaisFixos = [
      {
        nome: "Painel de Registro",
        channelId: canais.registro,
        payload: criarPainelRegistro()
      },
      {
        nome: "Painel de Dinheiro Sujo",
        channelId: canais.metaSemanal,
        payload: criarPainelFarm()
      },
      {
        nome: "Painel do Baú da Gerência • Entrada",
        channelId: canais.bauGerenciaEntrada,
        payload: criarPainelBau()
      },
      {
        nome: "Painel do Baú da Gerência • Saída",
        channelId: canais.bauGerenciaSaida,
        payload: criarPainelBau()
      },
      {
        nome: "Painel do Controle de Baú • Entrada",
        channelId: canais.controleBauEntrada,
        payload: criarPainelControleBau()
      },
      {
        nome: "Painel do Controle de Baú • Saída",
        channelId: canais.controleBauSaida,
        payload: criarPainelControleBau()
      },
      {
        nome: "Painel de Avisos",
        channelId: canais.canalAvisos || canais.categoriaAvisos,
        payload: criarPainelAvisos()
      },
      {
        nome: "Painel da Gerência",
        channelId: canais.chatGerencia || canais.logs,
        payload: criarPainelGerencia()
      }
    ];

    for (const item of canaisFixos) {
      try {
        const canal = await buscarCanal(guild, item.channelId);
        const resultado = await limparEEnviarPainel(canal, item.payload);

        if (resultado.ok) {
          resultados.push(`✅ ${item.nome} → **#${resultado.canal}** (apagadas: ${resultado.apagadas})`);
        } else {
          resultados.push(`❌ ${item.nome} → ${resultado.motivo}`);
        }
      } catch (error) {
        resultados.push(`❌ ${item.nome} → ${error.message}`);
      }
    }

    for (const membro of canaisFarmMembros) {
      try {
        const canal = await buscarCanal(guild, membro.channelId);

        if (!canal) {
          resultados.push(`❌ Painel Farm do membro **${membro.nome} | ${membro.passaporte}** → canal não encontrado`);
          continue;
        }

        const { apagadas } = await limparPaineisAntigosDoCanal(canal);
        await canal.send(criarPainelFarm());

        resultados.push(
          `✅ Painel Farm do membro **${membro.nome} | ${membro.passaporte}** → **#${canal.name}** (apagadas: ${apagadas})`
        );
      } catch (error) {
        resultados.push(`❌ Painel Farm do membro **${membro.nome} | ${membro.passaporte}** → ${error.message}`);
      }
    }

    return interaction.editReply({
      content: [
        "📌 **Atualização dos painéis concluída**",
        "",
        ...resultados
      ].join("\n")
    });
  }
};