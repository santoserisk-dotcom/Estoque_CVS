(() => {
  const el = {
    back: document.getElementById('btnBack'),
    theme: document.getElementById('btnTheme'),
    nav: document.querySelector('.bottom-nav'),
    app: document.getElementById('app'),
    connection: document.getElementById('connectionBadge'),
  };

  const historyStack = ['home'];
  let touchStartX = null;

  function updateConnection() {
    const online = navigator.onLine;
    el.connection.textContent = online ? 'Online' : 'Offline';
    el.connection.style.color = online ? 'var(--ok)' : 'var(--danger)';
  }

  function renderLoginView(message) {
    const loginView = document.getElementById('tplLogin').innerHTML;
    const errorMessage = message ? `<p class="help" style="color: var(--danger);">${message}</p>` : '';
    document.getElementById('view').innerHTML = `${loginView}${errorMessage}`;
    const loginButton = document.getElementById('btnLogin');
    if (loginButton) {
      loginButton.addEventListener('click', async () => {
        try {
          await Auth.loginWithGoogle();
          await boot();
        } catch (error) {
          renderLoginView(error.message || 'Falha ao autenticar.');
        }
      });
    }
  }

  async function boot() {
    UI.setRoute('home');
    updateConnection();

    const user = Auth.getUser();
    if (!user) {
      renderLoginView();
      return;
    }

    try {
      await Sync.fullLoad(user.token);
      const items = await DB.getAllItems();
      UI.setFeedback('ok', `Sincronização concluída com ${items.length} itens`);
    } catch (error) {
      const items = await DB.getAllItems();
      if (items.length) {
        UI.setFeedback('ok', `Offline: usando cache local (${items.length} itens)`);
      } else {
        UI.setFeedback('err', `Não foi possível sincronizar: ${error.message}`);
      }
    }
    await UI.render();
  }

  document.addEventListener('click', async (e) => {
    const route = e.target.dataset.route;
    const action = e.target.dataset.action;

    if (route) {
      const params = { category: e.target.dataset.category, itemId: e.target.dataset.itemId };
      UI.setRoute(route, params);
      historyStack.push(route);
      return;
    }

    if (action === 'withdraw') {
      UI.setRoute('withdraw', { itemId: e.target.dataset.itemId });
      historyStack.push('withdraw');
      return;
    }

    if (action === 'sync-now') {
      try {
        await Sync.fullLoad(Auth.getUser()?.token);
        UI.setFeedback('ok', 'Sincronização manual concluída');
      } catch (err) {
        UI.setFeedback('err', `Falha no sync: ${err.message}`);
      }
      UI.render();
      return;
    }

    if (action === 'config-gas') {
      const current = Sync.getGasUrl();
      const url = prompt('Cole a URL /exec do Web App do Apps Script', current.includes('COLE_AQUI') ? '' : current);
      if (url) {
        const saved = Sync.setGasUrl(url);
        if (saved) {
          UI.setFeedback('ok', 'URL da integração salva');
        } else {
          UI.setFeedback('err', 'URL inválida. Use a URL /exec do Web App do GAS.');
        }
        UI.render();
      }
      return;
    }

    if (action === 'logout') {
      Auth.clearUser();
      renderLoginView('Sessão encerrada. Faça login novamente.');
      return;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'searchInput') {
      UI.state.query = e.target.value;
      UI.render();
    }
  });

  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'withdrawForm') return;
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(e.target).entries());
    const item = (await DB.getAllItems()).find((i) => i.id === formData.itemId);
    const error = validateWithdrawal(formData, item);
    if (error) {
      UI.setFeedback('err', error);
      return UI.render();
    }

    try {
      await Sync.registerWithdrawal({ ...formData, quantity: Number(formData.quantity) }, Auth.getUser());
      UI.setFeedback('ok', 'Retirada registrada e fila atualizada');
      UI.setRoute('recent');
    } catch (err) {
      UI.setFeedback('err', err.message || 'Erro ao registrar retirada');
      UI.render();
    }
  });

  el.back.addEventListener('click', () => {
    historyStack.pop();
    UI.setRoute(historyStack[historyStack.length - 1] || 'home');
  });

  el.theme.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });

  el.nav.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab')) return;
    UI.setRoute(e.target.dataset.route);
    historyStack.push(e.target.dataset.route);
  });

  el.app.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; });
  el.app.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta > 80) el.back.click();
    touchStartX = null;
  });

  window.addEventListener('online', async () => {
    updateConnection();
    const user = Auth.getUser();
    if (!user) return;
    try {
      await Sync.flushQueue(user);
      UI.setFeedback('ok', 'Conexão restabelecida e fila sincronizada');
    } catch (error) {
      UI.setFeedback('err', `Não foi possível sincronizar: ${error.message}`);
    }
    UI.render();
  });

  window.addEventListener('offline', updateConnection);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }

  document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
  boot();

  function validateWithdrawal(data, item) {
    if (!item) return 'Item não encontrado';
    const qty = Number(data.quantity);
    if (!qty || qty <= 0) return 'Quantidade deve ser maior que zero';
    if (qty > Number(item.stock)) return 'Quantidade não pode exceder o estoque';
    if (!data.technician?.trim()) return 'Técnico é obrigatório';
    if (item.type === 'patrimonial') {
      const assets = (data.assets || '').split('\n').map((value) => value.trim()).filter(Boolean);
      if (assets.length !== qty) return 'Quantidade de patrimônios deve bater com a retirada';
    }
    return null;
  }
})();
