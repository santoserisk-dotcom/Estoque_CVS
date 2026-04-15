import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';
import type { InventoryItem, Technician, LogEntry, RetiradaPayload } from '../types/index.ts';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  throw new Error('Missing required Google Sheets environment variables.');
}

const PRIVATE_KEY_VALUE = PRIVATE_KEY;

let sheetsClient: sheets_v4.Sheets | null = null;

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) {
    return sheetsClient;
  }

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY_VALUE.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  await auth.authorize();
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function getSpreadsheetMetadata() {
  const sheets = await getSheetsClient();
  return sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: false
  });
}

async function ensureSheetExists(sheetName: string, headerRow: string[]) {
  const sheets = await getSheetsClient();
  const metadata = await getSpreadsheetMetadata();
  const exists = metadata.data.sheets?.some(sheet => sheet.properties?.title === sheetName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }]
      }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headerRow] }
    });
    return;
  }

  const values = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1`
  });

  const firstRow = values.data.values?.[0] || [];
  if (firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headerRow] }
    });
  }
}

export async function getInventoryList(): Promise<InventoryItem[]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'CVS!A2:E'
  });

  const rows = response.data.values || [];
  return rows
    .filter(row => (row[1] || '').toString().trim().length > 0)
    .map((row, index) => ({
      categoria: (row[0] || '').toString().trim(),
      nome: (row[1] || '').toString().trim(),
      unidade: (row[2] || 'un').toString().trim(),
      quantidadeAtual: Number(row[3] || 0),
      minimo: Number(row[4] || 0),
      rowIndex: index + 2
    }));
}

export async function getTechnicians(): Promise<Technician[]> {
  const sheets = await getSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TECNICOS!A2:C'
    });

    const rows = response.data.values || [];
    const technicians = rows
      .filter(row => (row[0] || '').toString().trim().length > 0)
      .map(row => ({
        pin: (row[0] || '').toString().trim(),
        nome: (row[1] || '').toString().trim(),
        ativo: (row[2] || '').toString().trim().toUpperCase() !== 'NÃO'
      }))
      .filter(tech => tech.pin.length > 0);

    if (technicians.length > 0) {
      return technicians;
    }
  } catch {
    // fallback abaixo
  }

  return [
    { pin: '1234', nome: 'Erick Santos', ativo: true },
    { pin: '5678', nome: 'André Souza', ativo: true },
    { pin: '9012', nome: 'Fernando Lima', ativo: true },
    { pin: '3456', nome: 'Rodrigo Mendez', ativo: true }
  ];
}

export async function getCriticalItems(): Promise<InventoryItem[]> {
  const items = await getInventoryList();
  return items.filter(item => item.quantidadeAtual <= item.minimo);
}

export async function getLogEntries(): Promise<LogEntry[]> {
  await ensureSheetExists('LOG_RETIRADAS', [
    'Timestamp',
    'Categoria',
    'Item',
    'Quantidade',
    'Unidade',
    'Patrimônios',
    'Técnico',
    'Observação',
    'Estoque Anterior',
    'Estoque Novo'
  ]);

  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LOG_RETIRADAS!A2:J'
  });

  const rows = response.data.values || [];
  return rows
    .filter(row => (row[0] || '').toString().trim().length > 0)
    .map(row => ({
      timestamp: (row[0] || '').toString().trim(),
      categoria: (row[1] || '').toString().trim(),
      item: (row[2] || '').toString().trim(),
      quantidade: Number(row[3] || 0),
      unidade: (row[4] || '').toString().trim(),
      patrimonios: (row[5] || '').toString().split(',').map((value: string) => value.trim()).filter(Boolean),
      tecnico: (row[6] || '').toString().trim(),
      observacao: (row[7] || '').toString().trim(),
      estoqueAnterior: Number(row[8] || 0),
      estoqueNovo: Number(row[9] || 0)
    }));
}

export async function updateInventoryQuantity(rowIndex: number, quantidade: number) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `CVS!D${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[quantidade]] }
  });
}

export async function appendLogEntry(entry: RetiradaPayload & { categoria: string; unidade: string; estoqueAnterior: number; estoqueNovo: number; timestamp?: string; }) {
  await ensureSheetExists('LOG_RETIRADAS', [
    'Timestamp',
    'Categoria',
    'Item',
    'Quantidade',
    'Unidade',
    'Patrimônios',
    'Técnico',
    'Observação',
    'Estoque Anterior',
    'Estoque Novo'
  ]);

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LOG_RETIRADAS!A:J',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        entry.timestamp || new Date().toISOString(),
        entry.categoria,
        entry.itemNome,
        entry.quantidade,
        entry.unidade,
        (entry.patrimonios || []).join(', '),
        entry.tecnico,
        entry.observacao || '',
        entry.estoqueAnterior,
        entry.estoqueNovo
      ]]
    }
  });
}
