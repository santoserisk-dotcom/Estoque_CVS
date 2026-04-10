const CONFIG = {
  SHEET_CVS: 'CVS',
  SHEET_LOG: 'LOG_RETIRADAS',
  ALLOWED_DOMAIN: 'empresa.com.br',
  ALLOWED_EMAILS: ['tecnico1@empresa.com.br', 'tecnico2@empresa.com.br'],
  STOCK_COL: 4,
  FIRST_ROW: 2,
};

function doGet(e) {
  return jsonOutput(routeGet_(e));
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  return jsonOutput(routePost_(body));
}

function routeGet_(e) {
  try {
    requireAuth_();
    if ((e.parameter.action || '') !== 'listItems') {
      return error_('INVALID_ACTION', 'Ação GET inválida', 400);
    }

    const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_CVS);
    const range = sheet.getRange(CONFIG.FIRST_ROW, 1, sheet.getLastRow() - 1, 16).getValues();

    const items = range
      .filter((r) => r[0])
      .map((r, idx) => ({
        id: String(r[0]),
        code: String(r[1] || ''),
        name: String(r[2] || ''),
        stock: Number(r[3] || 0),
        category: String(r[4] || 'Sem categoria'),
        minStock: Number(r[5] || 0),
        type: normalizeType_(r[6]),
        rowIndex: CONFIG.FIRST_ROW + idx,
      }));

    return ok_({ items }, { serverTime: new Date().toISOString() });
  } catch (err) {
    return normalizeError_(err);
  }
}

function routePost_(body) {
  try {
    const email = requireAuth_();
    if ((body.action || '') !== 'withdraw') {
      return error_('INVALID_ACTION', 'Ação POST inválida', 400);
    }

    const p = body.payload || {};
    validateWithdrawalPayload_(p);

    const ss = SpreadsheetApp.getActive();
    const cvs = ss.getSheetByName(CONFIG.SHEET_CVS);
    const log = ss.getSheetByName(CONFIG.SHEET_LOG) || ss.insertSheet(CONFIG.SHEET_LOG);

    const ids = cvs.getRange(CONFIG.FIRST_ROW, 1, cvs.getLastRow() - 1, 1).getValues().flat().map(String);
    const idx = ids.indexOf(String(p.itemId));
    if (idx < 0) return error_('NOT_FOUND', 'Item não localizado', 404);

    const row = CONFIG.FIRST_ROW + idx;
    const stockCell = cvs.getRange(row, CONFIG.STOCK_COL);
    const currentStock = Number(stockCell.getValue() || 0);
    if (p.quantity > currentStock) return error_('OUT_OF_STOCK', 'Estoque insuficiente', 409);

    const updatedStock = currentStock - Number(p.quantity);
    stockCell.setValue(updatedStock);

    log.appendRow([
      new Date(),
      email,
      p.technician,
      p.itemId,
      p.itemName,
      p.quantity,
      p.assets || '',
      p.note || '',
      updatedStock,
      p.createdAt || new Date().toISOString(),
    ]);

    return ok_({
      item: {
        id: String(p.itemId),
        name: String(p.itemName),
        stock: updatedStock,
      },
      receipt: Utilities.getUuid(),
    }, { serverTime: new Date().toISOString() });
  } catch (err) {
    return normalizeError_(err);
  }
}

function validateWithdrawalPayload_(p) {
  if (!p.itemId) throw error_('VALIDATION', 'itemId é obrigatório', 422);
  if (!p.itemName) throw error_('VALIDATION', 'itemName é obrigatório', 422);
  if (!p.technician) throw error_('VALIDATION', 'technician é obrigatório', 422);
  if (!p.quantity || Number(p.quantity) <= 0) throw error_('VALIDATION', 'quantity deve ser > 0', 422);

  const patrimonial = String(p.type || '').toLowerCase() === 'patrimonial';
  if (patrimonial) {
    const assets = String(p.assets || '').split('\n').filter(String);
    if (assets.length !== Number(p.quantity)) {
      throw error_('VALIDATION', 'Patrimônios devem corresponder à quantidade', 422);
    }
  }
}

function requireAuth_() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw error_('UNAUTHORIZED', 'Usuário sem e-mail ativo', 401);

  const allowedByDomain = email.endsWith('@' + CONFIG.ALLOWED_DOMAIN);
  const allowedByList = CONFIG.ALLOWED_EMAILS.indexOf(email) >= 0;
  if (!allowedByDomain && !allowedByList) {
    throw error_('FORBIDDEN', 'Usuário não autorizado', 403);
  }
  return email;
}

function normalizeType_(raw) {
  const value = String(raw || '').toLowerCase();
  if (value.indexOf('patrimonial') >= 0) return 'patrimonial';
  if (value.indexOf('estrutural') >= 0) return 'estrutural';
  return 'consumivel';
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
