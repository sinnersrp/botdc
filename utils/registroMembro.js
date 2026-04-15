const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType
} = require("discord.js");

const { canais, cargos } = require("../config/config");
const { criarPainelFarm } = require("./painelFarm");

const REGISTRO_BUTTON_ID = "registro_abrir_modal";
const REGISTRO_MODAL_ID = "registro_modal";

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function slugNome(nome = "") {
  return normalizarTexto(nome)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function capitalizarNome(nome = "") {
  return String(nome)
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(" ");
}

function getRoleIdsValidos(...valores) {
  const itens = valores.flatMap((valor) => {
    if (Array.isArray(valor)) return valor;
    return [valor];
  });

  return [...new Set(
    itens
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          if (typeof item.id === "string") return item.id.trim();
          if (typeof item.roleId === "string") return item.roleId.trim();
          if (typeof item.value === "string") return item.value.trim();
        }
        return null;
      })
      .filter((item) => item && /^\d+$/.test(item))
  )];
}

function criarPainelRegistro() {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📝 Painel de Registro")
    .setDescription(
      [
        "Use este painel para concluir seu registro.",
        "",
        "**Como funciona:**",
        "• clique em **Fazer registro**",
        "• preencha seu nome e passaporte",
        "• o bot cria sua aba de farm",
        "• o cargo de membro é aplicado automaticamente",
        "• o painel de farm já aparece na sua aba"
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Registro" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(REGISTRO_BUTTON_ID)
      .setLabel("Fazer registro")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Success)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

async function abrirModalRegistro(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(REGISTRO_MODAL_ID)
    .setTitle("Registro do membro");

  const nomeInput = new TextInputBuilder()
    .setCustomId("nome")
    .setLabel("Seu nome")
    .setPlaceholder("Ex: Sam")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40);

  const passaporteInput = new TextInputBuilder()
    .setCustomId("passaporte")
    .setLabel("Seu passaporte")
    .setPlaceholder("Ex: 187")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nomeInput),
    new ActionRowBuilder().addComponents(passaporteInput)
  );

  return interaction.showModal(modal);
}

function montarNomeCanalFarm(nome, passaporte) {
  return `💸 | ${normalizarTexto(nome).toLowerCase()} | ${passaporte}`;
}

async function buscarOuCriarCanalFarm(member, nome, passaporte) {
  const guild = member.guild;

  const nomeCanal = montarNomeCanalFarm(nome, passaporte);
  const parentId = canais.categoriaFarm || "1480507566302691412";

  const existentes = guild.channels.cache.filter(
    (channel) =>
      channel.parentId === String(parentId) &&
      channel.type === ChannelType.GuildText
  );

  const canalExistente = existentes.find((channel) => {
    const topic = String(channel.topic || "").trim();
    return topic === `farm:${member.id}`;
  });

  const liderancaIds = getRoleIdsValidos(
    cargos.cargo01,
    cargos.cargo02,
    cargos.cargo03,
    cargos.cargoGerenteGeral
  );

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
      type: OverwriteType.Role
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ],
      type: OverwriteType.Member
    }
  ];

  for (const roleId of liderancaIds) {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ],
      type: OverwriteType.Role
    });
  }

  if (canalExistente) {
    await canalExistente.edit({
      name: nomeCanal,
      topic: `farm:${member.id}`,
      permissionOverwrites
    });

    return canalExistente;
  }

  const canal = await guild.channels.create({
    name: nomeCanal,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `farm:${member.id}`,
    permissionOverwrites
  });

  return canal;
}

async function adicionarCargosRegistro(member) {
  const roleIds = getRoleIdsValidos(cargos.cargoMembro);

  if (!roleIds.length) return [];

  const cargosExistentes = roleIds.filter((roleId) => member.guild.roles.cache.has(roleId));
  if (!cargosExistentes.length) return [];

  const cargosParaAdicionar = cargosExistentes.filter(
    (roleId) => !member.roles.cache.has(roleId)
  );

  if (!cargosParaAdicionar.length) return [];

  await member.roles.add(cargosParaAdicionar);

  return cargosParaAdicionar;
}

async function enviarBoasVindasNoCanal(canal, member, nome, passaporte) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Registro concluído")
    .setDescription(
      [
        `Bem-vindo, ${member}!`,
        "",
        `**Nome:** ${nome}`,
        `**Passaporte:** ${passaporte}`,
        "",
        "Este agora é o seu canal de farm / dinheiro sujo."
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Registro" })
    .setTimestamp();

  await canal.send({
    content: `${member}`,
    embeds: [embed]
  });
}

async function limparPainelFarmAntigoDoCanal(canal) {
  if (!canal || !canal.isTextBased?.()) return;

  const mensagens = await canal.messages.fetch({ limit: 50 }).catch(() => null);
  if (!mensagens) return;

  const antigas = mensagens.filter((msg) => {
    if (!msg.author?.bot) return false;
    if (!msg.embeds?.length) return false;
    return String(msg.embeds[0]?.title || "").trim() === "💸 Painel de Dinheiro Sujo";
  });

  for (const [, msg] of antigas) {
    try {
      await msg.delete();
    } catch (_) {}
  }
}

async function enviarPainelFarmNoCanal(canal) {
  await limparPainelFarmAntigoDoCanal(canal);
  await canal.send(criarPainelFarm());
}

async function processarModalRegistro(interaction) {
  const nomeDigitado = interaction.fields.getTextInputValue("nome");
  const passaporteDigitado = interaction.fields.getTextInputValue("passaporte");

  const nome = capitalizarNome(normalizarTexto(nomeDigitado));
  const passaporte = somenteNumeros(passaporteDigitado);

  if (!nome || nome.length < 2) {
    return interaction.reply({
      content: "❌ Informe um nome válido.",
      flags: 64
    });
  }

  if (!passaporte || passaporte.length < 1) {
    return interaction.reply({
      content: "❌ Informe um passaporte válido.",
      flags: 64
    });
  }

  await interaction.deferReply({ flags: 64 });

  const member = await interaction.guild.members.fetch(interaction.user.id);

  const canal = await buscarOuCriarCanalFarm(member, nome, passaporte);
  const cargosAdicionados = await adicionarCargosRegistro(member);

  await enviarBoasVindasNoCanal(canal, member, nome, passaporte);
  await enviarPainelFarmNoCanal(canal);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Registro realizado com sucesso")
    .setDescription(
      [
        `👤 Membro: ${member}`,
        `📝 Nome: **${nome}**`,
        `🪪 Passaporte: **${passaporte}**`,
        `💬 Aba criada/atualizada: ${canal}`,
        `🏷️ Cargos adicionados: **${cargosAdicionados.length ? cargosAdicionados.length : 0}**`
      ].join("\n")
    )
    .setFooter({ text: "SINNERS BOT • Registro" })
    .setTimestamp();

  return interaction.editReply({
    embeds: [embed]
  });
}

module.exports = {
  REGISTRO_BUTTON_ID,
  REGISTRO_MODAL_ID,
  criarPainelRegistro,
  abrirModalRegistro,
  processarModalRegistro,
  enviarPainelFarmNoCanal,
  montarNomeCanalFarm
};