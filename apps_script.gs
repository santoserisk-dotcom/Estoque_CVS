const CONFIG = {
  SHEET_CVS: 'CVS',
  SHEET_LOG: 'LOG_RETIRADAS',
  ALLOWED_DOMAIN: 'empresa.com.br',
  ALLOWED_EMAILS: ['tecnico1@empresa.com.br', 'tecnico2@empresa.com.br'],
  STOCK_COL: 4,
  FIRST_ROW: 2,
  SHEET_COLUMNS: 16,
};

function doGet(e) {
  return jsonOutput(routeGet_(e));
}

function doPost(e) {
  return jsonOutput(routePost_(parseBody_(e.postData?.contents)));
}

function routeGet_(e) {
  try {
    const email = requireAuth_();
    const action = String(e.parameter.action || '').toLowerCase();

    if (action === 'listitems') {
      return listItems_();
    }

    if (action === 'whoami') {
      return whoAmI_(email);
    }

    return error_('INVALID_ACTION', 'Ação GET inválida', 400);
  } catch (err) {
    return normalizeError_(err);
  }
}

function routePost_(body) {
  try {
    const email = requireAuth_();
    const action = String(body.action || '').toLowerCase();

    if (action === 'withdraw') {
      return withdraw_(body.payload || {}, email);
    }

    return error_('INVALID_ACTION', 'Ação POST inválida', 400);
  } catch (err) {
    return normalizeError_(err);
  }
}

function listItems_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_CVS);
  if (!sheet) {
    return error_('MISSING_SHEET', 'Aba CVS não encontrada', 500);
  }

  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(0, lastRow - CONFIG.FIRST_ROW + 1);
  const values = rowCount > 0 ? sheet.getRange(CONFIG.FIRST_ROW, 1, rowCount, CONFIG.SHEET_COLUMNS).getValues() : [];

  const items = values
    .filter((row) => row[0])
    .map((row, idx) => normalizeItem_(row, idx));

  return ok_({ items }, { serverTime: new Date().toISOString() });
}

function whoAmI_(email) {
  return ok_({ email: email, domain: email.split('@').pop() }, { serverTime: new Date().toISOString() });
}

function withdraw_(payload, email) {
  validateWithdrawalPayload_(payload);

  const ss = SpreadsheetApp.getActive();
  const cvs = ss.getSheetByName(CONFIG.SHEET_CVS);
  if (!cvs) {
    return error_('MISSING_SHEET', 'Aba CVS não encontrada', 500);
  }

  const lastRow = cvs.getLastRow();
  const rowCount = Math.max(0, lastRow - CONFIG.FIRST_ROW + 1);
  const ids = rowCount > 0
    ? cvs.getRange(CONFIG.FIRST_ROW, 1, rowCount, 1).getValues().flat().map(String)
    : [];

  const idx = ids.indexOf(String(payload.itemId));
  if (idx < 0) return error_('NOT_FOUND', 'Item não localizado', 404);

  const row = CONFIG.FIRST_ROW + idx;
  const stockCell = cvs.getRange(row, CONFIG.STOCK_COL);
  const currentStock = Number(stockCell.getValue() || 0);
  if (payload.quantity > currentStock) return error_('OUT_OF_STOCK', 'Estoque insuficiente', 409);

  const updatedStock = currentStock - Number(payload.quantity);
  stockCell.setValue(updatedStock);

  const logSheet = ss.getSheetByName(CONFIG.SHEET_LOG) || ss.insertSheet(CONFIG.SHEET_LOG);
  logSheet.appendRow([
    new Date(),
    email,
    payload.technician,
    payload.itemId,
    payload.itemName,
    payload.quantity,
    payload.assets || '',
    payload.note || '',
    updatedStock,
    payload.createdAt || new Date().toISOString(),
  ]);

  return ok_({
    item: {
      id: String(payload.itemId),
      name: String(payload.itemName),
      stock: updatedStock,
    },
    receipt: Utilities.getUuid(),
  }, { serverTime: new Date().toISOString() });
}

function validateWithdrawalPayload_(payload) {
  if (!payload.itemId) throw error_('VALIDATION', 'itemId é obrigatório', 422);
  if (!payload.itemName) throw error_('VALIDATION', 'itemName é obrigatório', 422);
  if (!payload.technician) throw error_('VALIDATION', 'technician é obrigatório', 422);
  if (!payload.quantity || Number(payload.quantity) <= 0) throw error_('VALIDATION', 'quantity deve ser > 0', 422);

  const patrimonial = String(payload.type || '').toLowerCase() === 'patrimonial';
  if (patrimonial) {
    const assets = String(payload.assets || '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (assets.length !== Number(payload.quantity)) {
      throw error_('VALIDATION', 'Patrimônios devem corresponder à quantidade', 422);
    }
  }
}

function requireAuth_() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw error_('UNAUTHORIZED', 'Usuário sem e-mail ativo', 401);

  const allowedByDomain = CONFIG.ALLOWED_DOMAIN && email.endsWith(`@${CONFIG.ALLOWED_DOMAIN}`);
  const allowedByList = CONFIG.ALLOWED_EMAILS.indexOf(email) >= 0;
  if (!allowedByDomain && !allowedByList) {
    throw error_('FORBIDDEN', 'Usuário não autorizado', 403);
  }

  return email;
}

function normalizeItem_(row, index) {
  return {
    id: String(row[0] || '').trim(),
    code: String(row[1] || '').trim(),
    name: String(row[2] || '').trim(),
    stock: Number(row[3] || 0),
    category: String(row[4] || 'Sem categoria').trim(),
    minStock: Number(row[5] || 0),
    type: normalizeType_(row[6]),
    rowIndex: CONFIG.FIRST_ROW + index,
  };
}

function normalizeType_(raw) {
  const value = String(raw || '').toLowerCase();
  if (value.indexOf('patrimonial') >= 0) return 'patrimonial';
  if (value.indexOf('estrutural') >= 0) return 'estrutural';
  return 'consumivel';
}

function parseBody_(contents) {
  try {
    return contents ? JSON.parse(contents) : {};
  } catch (err) {
    return {};
  }
}

function ok_(data, meta) {
  return { ok: true, data: data || {}, error: null, meta: meta || {} };
}

function error_(code, message, status) {
  return { ok: false, data: null, error: { code: code, message: message, status: status || 500 }, meta: {} };
}

function normalizeError_(err) {
  if (err && err.ok === false) return err;
  return error_('INTERNAL', err && err.message ? err.message : 'Erro interno', 500);
}

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
