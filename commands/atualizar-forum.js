const { SlashCommandBuilder } = require("discord.js");
const { isGerenteOuLider } = require("../utils/permissoes");
const { canais } = require("../config/config");

const { criarPainelRegistro } = require("../utils/registroMembro");
const { criarPainelBau } = require("../utils/painelBau");
const { criarPainelControleBau } = require("../utils/painelControleBau");
const { criarPainelAvisos } = require("../utils/painelAvisos");

function criarPainelFarm() {
  return {
    embeds: [
      {
        color: 0x8e44ad,
        title: "💸 Painel de Dinheiro Sujo",
        description: [
          "Use este painel para registrar seu dinheiro sujo semanal.",
          "",
          "**Como funciona:**",
          "• clique em **Registrar dinheiro sujo**",
          "• informe o valor",
          "• depois envie a foto do comprovante no canal",
          "",
          "O bot vai registrar automaticamente."
        ].join("\n"),
        footer: {
          text: "SINNERS BOT • Dinheiro sujo"
        },
        timestamp: new Date().toISOString()
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            custom_id: "farm_registrar",
            label: "Registrar dinheiro sujo",
            emoji: {
              name: "💸"
            }
          }
        ]
      }
    ]
  };
}

function criarPainelGerencia() {
  return {
    embeds: [
      {
        color: 0x8e44ad,
        title: "🛠️ Painel da Gerência",
        description: [
          "Comandos úteis da gerência:",
          "",
          "• `/ver-caixa`",
          "• `/lavar-dinheiro`",
          "• `/historico-caixa`",
          "• `/ajuste-gerencia dinheiro-sujo`",
          "• `/ajuste-gerencia estoque`",
          "• `/remover-registro-farm`"
        ].join("\n"),
        footer: {
          text: "SINNERS BOT • Gerência"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

async function enviarSeExistir(guild, channelId, payload) {
  if (!channelId) return { ok: false, motivo: "ID não informado" };

  const canal =
    guild.channels.cache.get(String(channelId)) ||
    await guild.channels.fetch(String(channelId)).catch(() => null);

  if (!canal) {
    return { ok: false, motivo: `Canal ${channelId} não encontrado` };
  }

  await canal.send(payload);
  return { ok: true, canal: canal.name };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("atualizar-forum")
    .setDescription("Envia todos os painéis nos canais corretos"),

  async execute(interaction) {
    if (!isGerenteOuLider(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas a liderança pode usar este comando.",
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    const guild = interaction.guild;
    const resultados = [];

    const tarefas = [
      {
        nome: "Painel de Registro",
        canalId: canais.registro,
        payload: criarPainelRegistro()
      },
      {
        nome: "Painel de Dinheiro Sujo",
        canalId: canais.metaSemanal,
        payload: criarPainelFarm()
      },
      {
        nome: "Painel do Baú da Gerência • Entrada",
        canalId: canais.bauGerenciaEntrada,
        payload: criarPainelBau()
      },
      {
        nome: "Painel do Baú da Gerência • Saída",
        canalId: canais.bauGerenciaSaida,
        payload: criarPainelBau()
      },
      {
        nome: "Painel do Controle de Baú • Entrada",
        canalId: canais.controleBauEntrada,
        payload: criarPainelControleBau()
      },
      {
        nome: "Painel do Controle de Baú • Saída",
        canalId: canais.controleBauSaida,
        payload: criarPainelControleBau()
      },
      {
        nome: "Painel de Avisos",
        canalId: canais.canalAvisos || canais.categoriaAvisos,
        payload: criarPainelAvisos()
      },
      {
        nome: "Painel da Gerência",
        canalId: canais.chatGerencia || canais.logs || canais.bauGerenciaEntrada,
        payload: criarPainelGerencia()
      }
    ];

    for (const tarefa of tarefas) {
      try {
        const resultado = await enviarSeExistir(guild, tarefa.canalId, tarefa.payload);

        if (resultado.ok) {
          resultados.push(`✅ ${tarefa.nome} enviado em **#${resultado.canal}**`);
        } else {
          resultados.push(`❌ ${tarefa.nome}: ${resultado.motivo}`);
        }
      } catch (error) {
        resultados.push(`❌ ${tarefa.nome}: ${error.message}`);
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