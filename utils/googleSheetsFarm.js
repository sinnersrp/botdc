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

async function resetSheetVisualState(sheets, spreadsheetId, sheetIdNumber, maxColumns = 26, maxRows = 2000) {
  const requests = [
    {
      clearBasicFilter: {
        sheetId: sheetIdNumber
      }
    },
    {
      unmergeCells: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 0,
          endRowIndex: maxRows,
          startColumnIndex: 0,
          endColumnIndex: maxColumns
        }
      }
    }
  ];

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  } catch (error) {
    // Ignora erros caso não existam merges/filtros anteriores
  }
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
      farmNormal: 0
    };

    atual.total += Number(registro.valor) || 0;
    atual.registros += 1;

    if (registro.cargo === "ajuste") {
      atual.ajustes += Number(registro.valor) || 0;
    } else {
      atual.farmNormal += Number(registro.valor) || 0;
    }

    if (registro.cargo && registro.cargo !== "ajuste") {
      atual.cargo = registro.cargo;
    }

    agrupado.set(key, atual);
  }

  const linhas = [...agrupado.values()].map((item) => {
    const membro = memberMap.get(item.userId) || {
      nome: item.username,
      passaporte: "Não identificado"
    };

    const falta = Math.max(0, META_SEMANAL - item.total);
    const excedente = Math.max(0, item.total - META_SEMANAL);
    const valorLimpo = Math.floor(excedente * 0.5);
    const status = item.total >= META_SEMANAL ? "Bateu meta" : "Pendente";

    return {
      semanaId: item.semanaId,
      userId: item.userId,
      username: item.username,
      nome: membro.nome,
      passaporte: membro.passaporte,
      cargo: item.cargo,
      registros: item.registros,
      farmNormal: item.farmNormal,
      ajustes: item.ajustes,
      total: item.total,
      falta,
      excedente,
      valorLimpo,
      status
    };
  });

  return linhas.sort((a, b) => {
    if (a.semanaId !== b.semanaId) return a.semanaId.localeCompare(b.semanaId);
    return a.nome.localeCompare(b.nome);
  });
}

function montarLinhasSemana(registros, memberMap, semanaId) {
  const totalSemana = registros.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  const qtdRegistros = registros.length;
  const qtdAjustes = registros.filter((r) => r.cargo === "ajuste").length;

  const rows = [
    ["💸 RELATÓRIO SEMANAL DO FARM"],
    [getSheetWeekName(semanaId)],
    [],
    ["Total da semana", totalSemana, "Registros", qtdRegistros, "Ajustes", qtdAjustes],
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
      registro.cargo === "ajuste" ? "Ajuste manual" : "Farm normal",
      registro.comprovante || "Sem comprovante",
      registro.semanaId
    ]);
  }

  return rows;
}

function montarLinhasResumoGeral(resumo) {
  const totalGeral = resumo.reduce((acc, item) => acc + item.total, 0);
  const totalMembros = resumo.length;
  const bateram = resumo.filter((item) => item.status === "Bateu meta").length;
  const pendentes = resumo.filter((item) => item.status === "Pendente").length;

  const rows = [
    ["📊 RESUMO GERAL DO FARM"],
    ["Controle automático por semana e por membro"],
    [],
    ["Total geral", totalGeral, "Membros", totalMembros, "Bateram meta", bateram, "Pendentes", pendentes],
    [],
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

  for (const item of resumo) {
    rows.push([
      item.semanaId,
      item.username,
      item.nome,
      item.passaporte,
      item.cargo,
      item.registros,
      formatMoney(item.farmNormal),
      formatMoney(item.ajustes),
      formatMoney(item.total),
      formatMoney(item.falta),
      formatMoney(item.excedente),
      formatMoney(item.valorLimpo),
      item.status
    ]);
  }

  return rows;
}

function montarLinhasDashboard(resumo, semanaAtualId) {
  const semanaAtual = resumo
    .filter((item) => item.semanaId === semanaAtualId)
    .sort((a, b) => b.total - a.total);

  const totalSemana = semanaAtual.reduce((acc, item) => acc + item.total, 0);
  const totalMembros = semanaAtual.length;
  const bateram = semanaAtual.filter((item) => item.status === "Bateu meta").length;
  const pendentes = semanaAtual.filter((item) => item.status === "Pendente").length;

  const rows = [
    ["📈 DASHBOARD DO FARM"],
    [`Semana atual: ${getSheetWeekName(semanaAtualId)}`],
    [],
    ["Total da semana", totalSemana, "Membros", totalMembros],
    ["Bateram meta", bateram, "Pendentes", pendentes],
    [],
    ["Nome", "Passaporte", "Total", "Falta", "Status"]
  ];

  for (const item of semanaAtual) {
    rows.push([
      item.nome,
      item.passaporte,
      formatMoney(item.total),
      formatMoney(item.falta),
      item.status
    ]);
  }

  rows.push([]);
  rows.push(["Status", "Quantidade"]);
  rows.push(["Bateu meta", bateram]);
  rows.push(["Pendente", pendentes]);

  return {
    rows,
    tabelaInicio: 7,
    tabelaFim: 6 + semanaAtual.length,
    statusInicio: 9 + semanaAtual.length,
    statusFim: 10 + semanaAtual.length
  };
}

async function limparGraficosDaAba(sheets, spreadsheetId, title) {
  const info = await getSpreadsheetInfo(sheets, spreadsheetId);
  const target = info.sheets?.find((sheet) => sheet.properties?.title === title);

  if (!target?.charts?.length) return;

  const requests = target.charts.map((chart) => ({
    deleteEmbeddedObject: {
      objectId: chart.chartId
    }
  }));

  if (!requests.length) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

async function aplicarVisualSemana(sheets, spreadsheetId, title, sheetIdNumber, totalRows) {
  await resetSheetVisualState(sheets, spreadsheetId, sheetIdNumber, 10, Math.max(totalRows + 20, 200));

  const requests = [
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 10
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
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 10
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.23, green: 0.17, blue: 0.35 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              fontSize: 11,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 3,
          endRowIndex: 4,
          startColumnIndex: 0,
          endColumnIndex: 10
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.98 },
            textFormat: {
              bold: true
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 5,
          endRowIndex: 6,
          startColumnIndex: 0,
          endColumnIndex: 10
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.21, green: 0.48, blue: 0.39 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 6,
          endRowIndex: Math.max(totalRows, 7),
          startColumnIndex: 6,
          endColumnIndex: 7
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: "CURRENCY",
              pattern: "R$ #,##0"
            }
          }
        },
        fields: "userEnteredFormat.numberFormat"
      }
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheetIdNumber,
          gridProperties: {
            frozenRowCount: 6
          }
        },
        fields: "gridProperties.frozenRowCount"
      }
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId: sheetIdNumber,
            startRowIndex: 5,
            endRowIndex: Math.max(totalRows, 6),
            startColumnIndex: 0,
            endColumnIndex: 10
          }
        }
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
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

async function aplicarVisualResumo(sheets, spreadsheetId, title, sheetIdNumber, totalRows) {
  await resetSheetVisualState(sheets, spreadsheetId, sheetIdNumber, 13, Math.max(totalRows + 20, 200));

  const requests = [
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 13
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
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.23, green: 0.17, blue: 0.35 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              fontSize: 11,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 3,
          endRowIndex: 4,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.98 },
            textFormat: {
              bold: true
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 5,
          endRowIndex: 6,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.21, green: 0.48, blue: 0.39 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 6,
          endRowIndex: Math.max(totalRows, 7),
          startColumnIndex: 6,
          endColumnIndex: 12
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: "CURRENCY",
              pattern: "R$ #,##0"
            }
          }
        },
        fields: "userEnteredFormat.numberFormat"
      }
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId: sheetIdNumber,
              startRowIndex: 6,
              endRowIndex: Math.max(totalRows, 7),
              startColumnIndex: 12,
              endColumnIndex: 13
            }
          ],
          booleanRule: {
            condition: {
              type: "TEXT_EQ",
              values: [{ userEnteredValue: "Bateu meta" }]
            },
            format: {
              backgroundColor: { red: 0.85, green: 0.95, blue: 0.88 },
              textFormat: { bold: true }
            }
          }
        },
        index: 0
      }
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId: sheetIdNumber,
              startRowIndex: 6,
              endRowIndex: Math.max(totalRows, 7),
              startColumnIndex: 12,
              endColumnIndex: 13
            }
          ],
          booleanRule: {
            condition: {
              type: "TEXT_EQ",
              values: [{ userEnteredValue: "Pendente" }]
            },
            format: {
              backgroundColor: { red: 0.98, green: 0.88, blue: 0.88 },
              textFormat: { bold: true }
            }
          }
        },
        index: 0
      }
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheetIdNumber,
          gridProperties: {
            frozenRowCount: 6
          }
        },
        fields: "gridProperties.frozenRowCount"
      }
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId: sheetIdNumber,
            startRowIndex: 5,
            endRowIndex: Math.max(totalRows, 6),
            startColumnIndex: 0,
            endColumnIndex: 13
          }
        }
      }
    },
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId: sheetIdNumber,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: 13
        }
      }
    }
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

async function aplicarVisualDashboard(
  sheets,
  spreadsheetId,
  title,
  sheetIdNumber,
  totalRows,
  tabelaInicio,
  tabelaFim,
  statusInicio,
  statusFim
) {
  await limparGraficosDaAba(sheets, spreadsheetId, title);
  await resetSheetVisualState(sheets, spreadsheetId, sheetIdNumber, 10, Math.max(totalRows + 30, 300));

  const requests = [
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 5
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.17, green: 0.11, blue: 0.27 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              fontSize: 15,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 5
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.23, green: 0.17, blue: 0.35 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              fontSize: 11,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: 3,
          endRowIndex: 5,
          startColumnIndex: 0,
          endColumnIndex: 5
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.98 },
            textFormat: { bold: true }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: tabelaInicio - 1,
          endRowIndex: tabelaInicio,
          startColumnIndex: 0,
          endColumnIndex: 5
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.21, green: 0.48, blue: 0.39 },
            horizontalAlignment: "CENTER",
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 }
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: sheetIdNumber,
          startRowIndex: tabelaInicio,
          endRowIndex: Math.max(tabelaFim + 1, tabelaInicio + 1),
          startColumnIndex: 2,
          endColumnIndex: 4
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: "CURRENCY",
              pattern: "R$ #,##0"
            }
          }
        },
        fields: "userEnteredFormat.numberFormat"
      }
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId: sheetIdNumber,
              startRowIndex: tabelaInicio,
              endRowIndex: Math.max(tabelaFim + 1, tabelaInicio + 1),
              startColumnIndex: 4,
              endColumnIndex: 5
            }
          ],
          booleanRule: {
            condition: {
              type: "TEXT_EQ",
              values: [{ userEnteredValue: "Bateu meta" }]
            },
            format: {
              backgroundColor: { red: 0.85, green: 0.95, blue: 0.88 },
              textFormat: { bold: true }
            }
          }
        },
        index: 0
      }
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId: sheetIdNumber,
              startRowIndex: tabelaInicio,
              endRowIndex: Math.max(tabelaFim + 1, tabelaInicio + 1),
              startColumnIndex: 4,
              endColumnIndex: 5
            }
          ],
          booleanRule: {
            condition: {
              type: "TEXT_EQ",
              values: [{ userEnteredValue: "Pendente" }]
            },
            format: {
              backgroundColor: { red: 0.98, green: 0.88, blue: 0.88 },
              textFormat: { bold: true }
            }
          }
        },
        index: 0
      }
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheetIdNumber,
          gridProperties: {
            frozenRowCount: tabelaInicio
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
  ];

  if (tabelaFim >= tabelaInicio) {
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: "Total por membro na semana atual",
            basicChart: {
              chartType: "COLUMN",
              axis: [
                {
                  position: "BOTTOM_AXIS",
                  title: "Membros"
                },
                {
                  position: "LEFT_AXIS",
                  title: "Total"
                }
              ],
              domains: [
                {
                  domain: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: sheetIdNumber,
                          startRowIndex: tabelaInicio,
                          endRowIndex: tabelaFim + 1,
                          startColumnIndex: 0,
                          endColumnIndex: 1
                        }
                      ]
                    }
                  }
                }
              ],
              series: [
                {
                  series: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: sheetIdNumber,
                          startRowIndex: tabelaInicio,
                          endRowIndex: tabelaFim + 1,
                          startColumnIndex: 2,
                          endColumnIndex: 3
                        }
                      ]
                    }
                  },
                  targetAxis: "LEFT_AXIS"
                }
              ],
              headerCount: 0
            }
          },
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId: sheetIdNumber,
                rowIndex: 0,
                columnIndex: 7
              },
              offsetXPixels: 20,
              offsetYPixels: 10,
              widthPixels: 700,
              heightPixels: 350
            }
          }
        }
      }
    });
  }

  if (statusFim >= statusInicio) {
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: "Bateu meta x Pendentes",
            pieChart: {
              legendPosition: "RIGHT_LEGEND",
              domain: {
                sourceRange: {
                  sources: [
                    {
                      sheetId: sheetIdNumber,
                      startRowIndex: statusInicio,
                      endRowIndex: statusFim + 1,
                      startColumnIndex: 0,
                      endColumnIndex: 1
                    }
                  ]
                }
              },
              series: {
                sourceRange: {
                  sources: [
                    {
                      sheetId: sheetIdNumber,
                      startRowIndex: statusInicio,
                      endRowIndex: statusFim + 1,
                      startColumnIndex: 1,
                      endColumnIndex: 2
                    }
                  ]
                }
              }
            }
          },
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId: sheetIdNumber,
                rowIndex: 20,
                columnIndex: 7
              },
              offsetXPixels: 20,
              offsetYPixels: 10,
              widthPixels: 500,
              heightPixels: 300
            }
          }
        }
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

  const semanas = [...new Set(registros.map((r) => r.semanaId))].sort();
  const semanaAtualId = semanas.length ? semanas[semanas.length - 1] : null;

  const dashboardSheetId = await ensureSheetExists(sheets, spreadsheetId, "Dashboard");
  const resumoSheetId = await ensureSheetExists(sheets, spreadsheetId, "Resumo Geral");

  if (semanaAtualId) {
    const dashboard = montarLinhasDashboard(resumo, semanaAtualId);

    await clearSheet(sheets, spreadsheetId, "Dashboard");
    await writeSheet(sheets, spreadsheetId, "Dashboard", dashboard.rows);
    await aplicarVisualDashboard(
      sheets,
      spreadsheetId,
      "Dashboard",
      dashboardSheetId,
      dashboard.rows.length,
      dashboard.tabelaInicio,
      dashboard.tabelaFim,
      dashboard.statusInicio,
      dashboard.statusFim
    );
  }

  const resumoRows = montarLinhasResumoGeral(resumo);
  await clearSheet(sheets, spreadsheetId, "Resumo Geral");
  await writeSheet(sheets, spreadsheetId, "Resumo Geral", resumoRows);
  await aplicarVisualResumo(
    sheets,
    spreadsheetId,
    "Resumo Geral",
    resumoSheetId,
    resumoRows.length
  );

  for (const semanaId of semanas) {
    const title = getSheetWeekName(semanaId);
    const sheetWeekId = await ensureSheetExists(sheets, spreadsheetId, title);
    const registrosSemana = registros.filter((r) => r.semanaId === semanaId);
    const rows = montarLinhasSemana(registrosSemana, memberMap, semanaId);

    await clearSheet(sheets, spreadsheetId, title);
    await writeSheet(sheets, spreadsheetId, title, rows);
    await aplicarVisualSemana(
      sheets,
      spreadsheetId,
      title,
      sheetWeekId,
      rows.length
    );
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