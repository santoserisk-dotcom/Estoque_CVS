(() => {
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzdu7gRs3BUIM1YD652I3DgNspyjgF4UISQetS21GGfUSd92iN31PS9gBApAcvWVWUZ/exec';

  function getGasUrl() {
    return localStorage.getItem('gas_url') || DEFAULT_GAS_URL;
  }

  function setGasUrl(url) {
    localStorage.setItem('gas_url', String(url || '').trim());
  }

  function hasConfiguredGasUrl() {
    return getGasUrl() && !getGasUrl().includes('COLE_AQUI_URL_WEBAPP');
  }

  async function apiGet(path, token) {
    if (!hasConfiguredGasUrl()) {
      throw new Error('URL do Web App não configurada. Defina em Configurar integração na Home.');
    }
    const url = `${getGasUrl()}?action=${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Falha Apps Script GET (${res.status})`);
    
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdu7gRs3BUIM1YD652I3DgNspyjgF4UISQetS21GGfUSd92iN31PS9gBApAcvWVWUZ/exec';

  async function apiGet(path, token) {
    const url = `${GAS_URL}?action=${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Falha de conexão com Apps Script');
    return res.json();
  }

  async function apiPost(path, token, payload) {
    if (!hasConfiguredGasUrl()) {
      throw new Error('URL do Web App não configurada. Defina em Configurar integração na Home.');
    }
    const res = await fetch(getGasUrl(), {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: path, payload }),
    });
    if (!res.ok) throw new Error(`Falha Apps Script POST (${res.status})`);
      return res.json();
  }

  async function fullLoad(token) {
    const data = await apiGet('listItems', token);
    if (!data.ok) throw new Error(data.error?.message || 'Erro ao carregar dados');
    await DB.setItems(data.data.items || []);
    await DB.metaSet('lastSync', data.meta.serverTime || new Date().toISOString());
    await DB.metaSet('lastSyncStatus', { ok: true, message: 'Sincronização concluída', at: new Date().toISOString() });
    await DB.setItems(data.data.items);
    await DB.metaSet('lastSync', data.meta.serverTime);
    return data;
  }

  async function registerWithdrawal(withdrawal, user) {
    const allItems = await DB.getAllItems();
    const item = allItems.find((i) => i.id === withdrawal.itemId);
    if (!item) throw new Error('Item não encontrado em cache');

    item.stock = Number(item.stock) - Number(withdrawal.quantity);
    await DB.putItem(item);

    const localEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...withdrawal,
      userEmail: user.email,
      createdAt: new Date().toISOString(),
    };

    await DB.queuePush(localEntry);
    await DB.recentPut(localEntry);

    if (navigator.onLine) await flushQueue(user);
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
        const updatedItem = response.data.item;
        if (updatedItem) await DB.putItem(updatedItem);
      } catch (error) {
        await DB.metaSet('lastSyncStatus', { ok: false, message: error.message, at: new Date().toISOString() });
        throw error;
      }
    }
    await DB.metaSet('lastSyncStatus', { ok: true, message: 'Fila sincronizada', at: new Date().toISOString() });
  }

  window.Sync = { fullLoad, registerWithdrawal, flushQueue, getGasUrl, setGasUrl, hasConfiguredGasUrl };
})();
