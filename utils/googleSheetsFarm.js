const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const FarmRegistro = require("../models/FarmRegistro");
const { canais } = require("../config/config");

const META_SEMANAL = 100000;

function formatMoney(value) {
  return Number(value) || 0;
}

function formatDateBR(date) {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
}

function formatTimeBR(date) {
  const d = new Date(date);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSheetWeekName(semanaId = "") {
  const [inicio, fim] = String(semanaId).split("_");
  if (!inicio || !fim) return semanaId;

  const [anoI, mesI, diaI] = inicio.split("-");
  const [anoF, mesF, diaF] = fim.split("-");

  return `${diaI}-${mesI} a ${diaF}-${mesF}`;
}

function limparNomeCanal(nome = "") {
  return String(nome)
    .replace(/^arquivado-/, "")
    .replace(/^💸┃/, "")
    .replace(/┃/g, "|")
    .trim();
}

function extrairNomeEPassaporte(nomeCanal = "") {
  const limpo = limparNomeCanal(nomeCanal);
  const partes = limpo.split("|").map((p) => p.trim());

  if (partes.length >= 2) {
    return {
      nome: partes[0],
      passaporte: partes[1]
    };
  }

  return {
    nome: limpo || "Não identificado",
    passaporte: "Não identificado"
  };
}

async function getGoogleSheetsClient() {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const serviceFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!sheetId) {
    throw new Error("GOOGLE_SHEETS_ID não configurado no .env");
  }

  if (!serviceFile) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_FILE não configurado no .env");
  }

  const absolutePath = path.resolve(serviceFile);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo da conta de serviço não encontrado: ${absolutePath}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: absolutePath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  return {
    sheets,
    sheetId
  };
}

async function getSpreadsheetInfo(sheets, sheetId) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId
  });

  return response.data;
}

async function ensureSheetExists(sheets, sheetId, title) {
  const info = await getSpreadsheetInfo(sheets, sheetId);
  const exists = info.sheets?.some((sheet) => sheet.properties?.title === title);

  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title
            }
          }
        }
      ]
    }
  });
}

async function clearSheet(sheets, sheetId, title) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `${title}!A:Z`
  });
}

async function writeSheet(sheets, sheetId, title, rows) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${title}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows
    }
  });
}

async function formatSheetHeader(sheets, sheetId, title) {
  const info = await getSpreadsheetInfo(sheets, sheetId);
  const target = info.sheets?.find((sheet) => sheet.properties?.title === title);
  if (!target) return;

  const sheetIdNumber = target.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetIdNumber,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.18,
                  green: 0.12,
                  blue: 0.28
                },
                horizontalAlignment: "CENTER",
                textFormat: {
                  foregroundColor: {
                    red: 1,
                    green: 1,
                    blue: 1
                  },
                  bold: true,
                  fontSize: 11
                }
              }
            },
            fields:
              "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
          }
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheetIdNumber,
              gridProperties: {
                frozenRowCount: 1
              }
            },
            fields: "gridProperties.frozenRowCount"
          }
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: sheetIdNumber,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 10
            }
          }
        }
      ]
    }
  });
}

async function montarMapaMembros(guild) {
  await guild.channels.fetch().catch(() => null);

  const mapa = new Map();

  guild.channels.cache
    .filter(
      (channel) =>
        channel.parentId === canais.categoriaFarmPrivado &&
        channel.topic &&
        channel.topic.startsWith("farm:")
    )
    .forEach((channel) => {
      const userId = channel.topic.replace("farm:", "").trim();
      const dados = extrairNomeEPassaporte(channel.name);

      mapa.set(userId, {
        nome: dados.nome,
        passaporte: dados.passaporte
      });
    });

  return mapa;
}

function montarLinhasSemana(registros, memberMap) {
  const rows = [
    [
      "Data",
      "Hora",
      "Usuário Discord",
      "Nome",
      "Passaporte",
      "Cargo",
      "Valor",
      "Tipo",
      "Comprovante / Observação",
      "Semana"
    ]
  ];

  for (const registro of registros) {
    const membro = memberMap.get(registro.userId) || {
      nome: registro.username || "Não identificado",
      passaporte: "Não identificado"
    };

    rows.push([
      formatDateBR(registro.registradoEm),
      formatTimeBR(registro.registradoEm),
      registro.username || "Sem usuário",
      membro.nome,
      membro.passaporte,
      registro.cargo || "membro",
      formatMoney(registro.valor),
      registro.cargo === "ajuste" ? "Ajuste manual" : "Farm normal",
      registro.comprovante || "Sem comprovante",
      registro.semanaId
    ]);
  }

  return rows;
}

function montarResumoGeral(registros, memberMap) {
  const agrupado = new Map();

  for (const registro of registros) {
    const key = `${registro.semanaId}::${registro.userId}`;
    const atual = agrupado.get(key) || {
      semanaId: registro.semanaId,
      userId: registro.userId,
      username: registro.username || "Sem usuário",
      cargo: registro.cargo || "membro",
      total: 0,
      registros: 0,
      ajustes: 0,
      farmNormal: 0
    };

    atual.total += Number(registro.valor) || 0;
    atual.registros += 1;

    if (registro.cargo === "ajuste") {
      atual.ajustes += Number(registro.valor) || 0;
    } else {
      atual.farmNormal += Number(registro.valor) || 0;
    }

    agrupado.set(key, atual);
  }

  const rows = [
    [
      "Semana",
      "Usuário Discord",
      "Nome",
      "Passaporte",
      "Cargo",
      "Registros",
      "Farm normal",
      "Ajustes",
      "Total",
      "Falta para meta",
      "Excedente",
      "Valor limpo",
      "Status"
    ]
  ];

  const ordenado = [...agrupado.values()].sort((a, b) => {
    if (a.semanaId !== b.semanaId) return a.semanaId.localeCompare(b.semanaId);
    return a.username.localeCompare(b.username);
  });

  for (const item of ordenado) {
    const membro = memberMap.get(item.userId) || {
      nome: item.username,
      passaporte: "Não identificado"
    };

    const falta = Math.max(0, META_SEMANAL - item.total);
    const excedente = Math.max(0, item.total - META_SEMANAL);
    const valorLimpo = Math.floor(excedente * 0.5);
    const status = item.total >= META_SEMANAL ? "Bateu meta" : "Pendente";

    rows.push([
      item.semanaId,
      item.username,
      membro.nome,
      membro.passaporte,
      item.cargo,
      item.registros,
      formatMoney(item.farmNormal),
      formatMoney(item.ajustes),
      formatMoney(item.total),
      formatMoney(falta),
      formatMoney(excedente),
      formatMoney(valorLimpo),
      status
    ]);
  }

  return rows;
}

async function sincronizarPlanilhaFarm(guild) {
  const { sheets, sheetId } = await getGoogleSheetsClient();
  const memberMap = await montarMapaMembros(guild);
  const registros = await FarmRegistro.find({}).sort({ registradoEm: 1 });

  await ensureSheetExists(sheets, sheetId, "Resumo Geral");

  const semanas = [...new Set(registros.map((r) => r.semanaId))];

  for (const semanaId of semanas) {
    const title = getSheetWeekName(semanaId);
    const registrosSemana = registros.filter((r) => r.semanaId === semanaId);

    await ensureSheetExists(sheets, sheetId, title);
    await clearSheet(sheets, sheetId, title);
    await writeSheet(sheets, sheetId, title, montarLinhasSemana(registrosSemana, memberMap));
    await formatSheetHeader(sheets, sheetId, title);
  }

  await clearSheet(sheets, sheetId, "Resumo Geral");
  await writeSheet(sheets, sheetId, "Resumo Geral", montarResumoGeral(registros, memberMap));
  await formatSheetHeader(sheets, sheetId, "Resumo Geral");

  return {
    totalRegistros: registros.length,
    totalSemanas: semanas.length,
    link: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
  };
}

module.exports = {
  sincronizarPlanilhaFarm
};