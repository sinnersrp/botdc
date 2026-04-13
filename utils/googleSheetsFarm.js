const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const FarmRegistro = require("../models/FarmRegistro");
const MovimentacaoCaixa = require("../models/MovimentacaoCaixa");
const { sincronizarCaixaFaccao } = require("./financeiroFaccao");
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

  const [, mesI, diaI] = inicio.split("-");
  const [, mesF, diaF] = fim.split("-");

  return `${diaI}-${mesI} a ${diaF}-${mesF}`;
}

function limparNomeCanal(nome = "") {
  return String(nome)
    .replace(/^arquivado-/, "")
    .replace(/^💸┃/, "")
    .replace(/┃/g, "|")
    .replace(/-/g, " ")
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
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const serviceFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!spreadsheetId) {
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
    spreadsheetId
  };
}

async function getSpreadsheetInfo(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId
  });

  return response.data;
}

async function ensureSheetExists(sheets, spreadsheetId, title) {
  const info = await getSpreadsheetInfo(sheets, spreadsheetId);
  const existing = info.sheets?.find((sheet) => sheet.properties?.title === title);

  if (existing) {
    return existing.properties.sheetId;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
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

  const updatedInfo = await getSpreadsheetInfo(sheets, spreadsheetId);
  const created = updatedInfo.sheets?.find((sheet) => sheet.properties?.title === title);

  return created?.properties?.sheetId;
}

async function clearSheet(sheets, spreadsheetId, title) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${title}!A:Z`
  });
}

async function writeSheet(sheets, spreadsheetId, title, rows) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows
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

function agruparResumoPorSemanaEMembro(registros, memberMap) {
  const agrupado = new Map();

  for (const registro of registros) {
    const key = `${registro.semanaId}::${registro.userId}`;
    const atual = agrupado.get(key) || {
      semanaId: registro.semanaId,
      userId: registro.userId,
      username: registro.username || "Sem usuário",
      cargo: "membro",
      total: 0,
      registros: 0,
      ajustes: 0,
      dinheiroSujo: 0
    };

    atual.total += Number(registro.valor) || 0;
    atual.registros += 1;

    if (registro.cargo === "ajuste") {
      atual.ajustes += Number(registro.valor) || 0;
    } else {
      atual.dinheiroSujo += Number(registro.valor) || 0;
    }

    if (registro.cargo && registro.cargo !== "ajuste") {
      atual.cargo = registro.cargo;
    }

    agrupado.set(key, atual);
  }

  return [...agrupado.values()].map((item) => {
    const membro = memberMap.get(item.userId) || {
      nome: item.username,
      passaporte: "Não identificado"
    };

    const falta = Math.max(0, META_SEMANAL - item.total);
    const excedente = Math.max(0, item.total - META_SEMANAL);
    const valorLimpoEstimado = Math.floor(excedente * 0.5);
    const status = item.total >= META_SEMANAL ? "Bateu meta" : "Pendente";

    return {
      semanaId: item.semanaId,
      username: item.username,
      nome: membro.nome,
      passaporte: membro.passaporte,
      cargo: item.cargo,
      registros: item.registros,
      dinheiroSujo: item.dinheiroSujo,
      ajustes: item.ajustes,
      total: item.total,
      falta,
      excedente,
      valorLimpoEstimado,
      status
    };
  }).sort((a, b) => {
    if (a.semanaId !== b.semanaId) return a.semanaId.localeCompare(b.semanaId);
    return a.nome.localeCompare(b.nome);
  });
}

function montarLinhasDashboard(resumo, semanaAtualId, caixa) {
  const semanaAtual = resumo
    .filter((item) => item.semanaId === semanaAtualId)
    .sort((a, b) => b.total - a.total);

  const totalSemana = semanaAtual.reduce((acc, item) => acc + item.total, 0);
  const bateram = semanaAtual.filter((item) => item.status === "Bateu meta").length;
  const pendentes = semanaAtual.filter((item) => item.status === "Pendente").length;

  const rows = [
    ["📈 DASHBOARD FINANCEIRO DA FACÇÃO"],
    [`Semana atual: ${semanaAtualId ? getSheetWeekName(semanaAtualId) : "Sem registros"}`],
    [],
    ["Resumo financeiro", ""],
    ["Dinheiro sujo total", formatMoney(caixa.dinheiroSujoTotal)],
    ["Dinheiro sujo disponível", formatMoney(caixa.dinheiroSujoDisponivel)],
    ["Dinheiro limpo total", formatMoney(caixa.dinheiroLimpoTotal)],
    ["Caixa total", formatMoney(caixa.caixaTotal)],
    ["Total lavado", formatMoney(caixa.totalLavado)],
    ["Total da semana atual", formatMoney(totalSemana)],
    ["Bateram meta", bateram],
    ["Pendentes", pendentes],
    [],
    ["Top membros da semana", ""],
    ["Nome", "Passaporte", "Total", "Falta", "Status"]
  ];

  for (const item of semanaAtual.slice(0, 10)) {
    rows.push([
      item.nome,
      item.passaporte,
      formatMoney(item.total),
      formatMoney(item.falta),
      item.status
    ]);
  }

  return rows;
}

function montarLinhasResumoGeral(resumo) {
  const rows = [
    ["📊 RESUMO GERAL DO DINHEIRO SUJO"],
    ["Controle automático por semana e por membro"],
    [],
    [
      "Semana",
      "Usuário Discord",
      "Nome",
      "Passaporte",
      "Cargo",
      "Registros",
      "Dinheiro sujo",
      "Ajustes",
      "Total",
      "Falta para meta",
      "Excedente",
      "Valor limpo estimado",
      "Status"
    ]
  ];

  for (const item of resumo) {
    rows.push([
      item.semanaId,
      item.username,
      item.nome,
      item.passaporte,
      item.cargo,
      item.registros,
      formatMoney(item.dinheiroSujo),
      formatMoney(item.ajustes),
      formatMoney(item.total),
      formatMoney(item.falta),
      formatMoney(item.excedente),
      formatMoney(item.valorLimpoEstimado),
      item.status
    ]);
  }

  return rows;
}

function montarLinhasCaixa(caixa, movimentacoes) {
  const rows = [
    ["🏦 CAIXA DA FACÇÃO"],
    [],
    ["Dinheiro sujo total", formatMoney(caixa.dinheiroSujoTotal)],
    ["Dinheiro sujo disponível", formatMoney(caixa.dinheiroSujoDisponivel)],
    ["Dinheiro limpo total", formatMoney(caixa.dinheiroLimpoTotal)],
    ["Caixa total", formatMoney(caixa.caixaTotal)],
    ["Total lavado", formatMoney(caixa.totalLavado)],
    [],
    ["Histórico recente"],
    ["Data", "Responsável", "Tipo", "Valor", "Observação"]
  ];

  for (const mov of movimentacoes) {
    rows.push([
      new Date(mov.registradoEm).toLocaleString("pt-BR"),
      mov.responsavelTag,
      mov.tipo,
      formatMoney(mov.valor),
      mov.observacao || ""
    ]);
  }

  return rows;
}

function montarLinhasSemana(registros, memberMap, semanaId) {
  const rows = [
    ["💸 RELATÓRIO SEMANAL DO DINHEIRO SUJO"],
    [getSheetWeekName(semanaId)],
    [],
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
      registro.cargo === "ajuste" ? "Ajuste manual" : "Dinheiro sujo",
      registro.comprovante || "Sem comprovante",
      registro.semanaId
    ]);
  }

  return rows;
}

async function aplicarVisualPadrao(sheets, spreadsheetId, sheetIdNumber, totalRows, totalCols, currencyCols = []) {
  const requests = [
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: totalCols
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.17, green: 0.11, blue: 0.27 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              fontSize: 14,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
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
          endIndex: totalCols
        }
      }
    }
  ];

  for (const col of currencyCols) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 1,
          endRowIndex: Math.max(totalRows, 2),
          startColumnIndex: col,
          endColumnIndex: col + 1
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: "CURRENCY",
              pattern: "R$ #,##0.00"
            }
          }
        },
        fields: "userEnteredFormat.numberFormat"
      }
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

async function removerAbaPadraoVazia(sheets, spreadsheetId) {
  const info = await getSpreadsheetInfo(sheets, spreadsheetId);
  const sheetsList = info.sheets || [];

  if (sheetsList.length <= 1) return;

  for (const sheet of sheetsList) {
    const title = sheet.properties?.title || "";
    const sheetIdNumber = sheet.properties?.sheetId;

    const abaProtegida =
      title === "Dashboard" ||
      title === "Resumo Geral" ||
      title === "Caixa da Facção" ||
      /^(\d{2}-\d{2} a \d{2}-\d{2})$/.test(title);

    if (abaProtegida) continue;

    const values = await sheets.spreadsheets.values
      .get({
        spreadsheetId,
        range: `${title}!A1:Z10`
      })
      .catch(() => null);

    const linhas = values?.data?.values || [];
    const temConteudo = linhas.some((linha) =>
      linha.some((celula) => String(celula).trim() !== "")
    );

    if (!temConteudo && typeof sheetIdNumber === "number") {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteSheet: {
                sheetId: sheetIdNumber
              }
            }
          ]
        }
      });
      break;
    }
  }
}

async function sincronizarPlanilhaFarm(guild) {
  const { sheets, spreadsheetId } = await getGoogleSheetsClient();
  const memberMap = await montarMapaMembros(guild);
  const registros = await FarmRegistro.find({}).sort({ registradoEm: 1 });
  const resumo = agruparResumoPorSemanaEMembro(registros, memberMap);
  const caixa = await sincronizarCaixaFaccao();
  const movimentacoes = await MovimentacaoCaixa.find({})
    .sort({ registradoEm: -1 })
    .limit(30);

  const semanas = [...new Set(registros.map((r) => r.semanaId))].sort();
  const semanaAtualId = semanas.length ? semanas[semanas.length - 1] : null;

  const dashboardSheetId = await ensureSheetExists(sheets, spreadsheetId, "Dashboard");
  const resumoSheetId = await ensureSheetExists(sheets, spreadsheetId, "Resumo Geral");
  const caixaSheetId = await ensureSheetExists(sheets, spreadsheetId, "Caixa da Facção");

  const dashboardRows = montarLinhasDashboard(resumo, semanaAtualId, caixa);
  await clearSheet(sheets, spreadsheetId, "Dashboard");
  await writeSheet(sheets, spreadsheetId, "Dashboard", dashboardRows);
  await aplicarVisualPadrao(sheets, spreadsheetId, dashboardSheetId, dashboardRows.length, 5, [1]);

  const resumoRows = montarLinhasResumoGeral(resumo);
  await clearSheet(sheets, spreadsheetId, "Resumo Geral");
  await writeSheet(sheets, spreadsheetId, "Resumo Geral", resumoRows);
  await aplicarVisualPadrao(sheets, spreadsheetId, resumoSheetId, resumoRows.length, 13, [6, 7, 8, 9, 10, 11]);

  const caixaRows = montarLinhasCaixa(caixa, movimentacoes);
  await clearSheet(sheets, spreadsheetId, "Caixa da Facção");
  await writeSheet(sheets, spreadsheetId, "Caixa da Facção", caixaRows);
  await aplicarVisualPadrao(sheets, spreadsheetId, caixaSheetId, caixaRows.length, 5, [1, 3]);

  for (const semanaId of semanas) {
    const title = getSheetWeekName(semanaId);
    const sheetWeekId = await ensureSheetExists(sheets, spreadsheetId, title);
    const registrosSemana = registros.filter((r) => r.semanaId === semanaId);
    const rows = montarLinhasSemana(registrosSemana, memberMap, semanaId);

    await clearSheet(sheets, spreadsheetId, title);
    await writeSheet(sheets, spreadsheetId, title, rows);
    await aplicarVisualPadrao(sheets, spreadsheetId, sheetWeekId, rows.length, 10, [6]);
  }

  await removerAbaPadraoVazia(sheets, spreadsheetId);

  return {
    totalRegistros: registros.length,
    totalSemanas: semanas.length,
    link: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  };
}

module.exports = {
  sincronizarPlanilhaFarm
};