(() => {
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxvdQrPX7RRnxLiyRqPrAWwNA1iO561HrgsFU3_7I5byk3Y6IHotzP8N7kIAzrBoGDP/exec';
  const GAS_PLACEHOLDER = 'COLE_AQUI_URL_WEBAPP';

  function getGasUrl() {
    return localStorage.getItem('gas_url') || DEFAULT_GAS_URL;
  }

  function isValidGasUrl(url) {
    const value = String(url || '').trim();
    if (!value) return false;
    if (value.includes(GAS_PLACEHOLDER)) return false;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(value)) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  function setGasUrl(url) {
    const normalized = String(url || '').trim();
    if (!isValidGasUrl(normalized)) {
      localStorage.removeItem('gas_url');
      return false;
    }
    localStorage.setItem('gas_url', normalized);
    return true;
  }

  function hasConfiguredGasUrl() {
    return isValidGasUrl(getGasUrl());
  }

  async function apiFetch(path, token, method = 'GET', payload = null) {
    if (!hasConfiguredGasUrl()) {
      throw new Error('URL do Web App não configurada. Defina em Configurar integração na Home.');
    }

    const url = new URL(getGasUrl());
    url.searchParams.set('origin', window.location.origin);
    const init = {
      method,
      mode: 'cors',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    };

    if (token) {
      init.headers.Authorization = `Bearer ${token}`;
    }

    if (method === 'GET') {
      url.searchParams.set('action', path);
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify({ action: path, payload });
    }

    const response = await fetch(url.toString(), init);
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (err) {
      throw new Error(`Resposta inválida do Web App (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(json?.error?.message || `Falha Apps Script (${response.status})`);
    }

    return json;
  }

  function apiGet(path, token) {
    return apiFetch(path, token, 'GET');
  }

  function apiPost(path, token, payload) {
    return apiFetch(path, token, 'POST', payload);
  }

  async function whoAmI(token) {
    return apiGet('whoami', token);
  }

  function normalizeItem(item) {
    return {
      id: String(item.id ?? item[0] ?? '').trim(),
      code: String(item.code ?? item[1] ?? '').trim(),
      name: String(item.name ?? item[2] ?? '').trim(),
      stock: Number(item.stock ?? item[3] ?? 0),
      category: String(item.category ?? item[4] ?? 'Sem categoria').trim(),
      minStock: Number(item.minStock ?? item[5] ?? 0),
      type: String(item.type ?? item[6] ?? 'consumivel').toLowerCase(),
      rowIndex: item.rowIndex ?? null,
    };
  }

  async function fullLoad(token) {
    const data = await apiGet('listItems', token);
    if (!data.ok) throw new Error(data.error?.message || 'Erro ao carregar dados');

    const items = Array.isArray(data.data?.items) ? data.data.items.map(normalizeItem) : [];
    await DB.setItems(items);
    await DB.metaSet('lastSync', data.meta?.serverTime || new Date().toISOString());
    await DB.metaSet('lastSyncStatus', {
      ok: true,
      message: 'Sincronização concluída',
      at: new Date().toISOString(),
    });
    return data;
  }

  async function registerWithdrawal(withdrawal, user) {
    const allItems = await DB.getAllItems();
    const item = allItems.find((i) => i.id === withdrawal.itemId);
    if (!item) throw new Error('Item não encontrado em cache');

    const quantity = Number(withdrawal.quantity);
    if (!quantity || quantity <= 0) throw new Error('Quantidade deve ser maior que zero');
    if (quantity > Number(item.stock)) throw new Error('Quantidade não pode exceder o estoque');

    item.stock = Number(item.stock) - quantity;
    await DB.putItem(item);

    const localEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...withdrawal,
      userEmail: user.email,
      createdAt: new Date().toISOString(),
    };

    await DB.queuePush(localEntry);
    await DB.recentPut(localEntry);

    if (navigator.onLine) {
      await flushQueue(user);
    }

    return localEntry;
  }

  async function flushQueue(user) {
    const jobs = await DB.queueAll();
    for (const job of jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      try {
        const response = await apiPost('withdraw', user.token, job);
        if (!response.ok) throw new Error(response.error?.message || 'Erro ao sincronizar');

        await DB.queueDelete(job.id);
        if (response.data?.item) {
          await DB.putItem(normalizeItem(response.data.item));
        }
      } catch (error) {
        await DB.metaSet('lastSyncStatus', {
          ok: false,
          message: error.message,
          at: new Date().toISOString(),
        });
        throw error;
      }
    }

    await DB.metaSet('lastSyncStatus', {
      ok: true,
      message: 'Fila sincronizada',
      at: new Date().toISOString(),
    });
  }

  window.Sync = {
    getGasUrl,
    setGasUrl,
    hasConfiguredGasUrl,
    whoAmI,
    fullLoad,
    registerWithdrawal,
    flushQueue,
  };
})();
