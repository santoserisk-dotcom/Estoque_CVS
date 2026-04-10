(() => {
  const GAS_URL = 'COLE_AQUI_URL_WEBAPP';

  async function apiGet(path, token) {
    const url = `${GAS_URL}?action=${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Falha de conexão com Apps Script');
    return res.json();
  }

  async function apiPost(path, token, payload) {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: path, payload }),
    });
    if (!res.ok) throw new Error('Falha no envio ao Apps Script');
    return res.json();
  }

  async function fullLoad(token) {
    const data = await apiGet('listItems', token);
    if (!data.ok) throw new Error(data.error?.message || 'Erro ao carregar dados');
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
        if (!response.ok) {
          if (response.error?.code === 'STALE_WRITE') continue;
          throw new Error(response.error?.message || 'Erro ao sincronizar');
        }
        await DB.queueDelete(job.id);
        const updatedItem = response.data.item;
        if (updatedItem) await DB.putItem(updatedItem);
      } catch (error) {
        console.warn('Fila pendente', error.message);
        break;
      }
    }
  }

  window.Sync = { fullLoad, registerWithdrawal, flushQueue };
})();
