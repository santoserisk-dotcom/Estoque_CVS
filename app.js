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

  function validateWithdrawal(data, item) {
    const qty = Number(data.quantity);
    if (!qty || qty <= 0) return 'Quantidade deve ser maior que zero';
    if (qty > Number(item.stock)) return 'Quantidade não pode exceder o estoque';
    if (!data.technician?.trim()) return 'Técnico é obrigatório';
    if (item.type === 'patrimonial') {
      const assets = (data.assets || '').split('\n').filter(Boolean);
      if (assets.length !== qty) return 'Quantidade de patrimônios deve bater com a retirada';
    }
    return null;
  }

  async function boot() {
    UI.setRoute('home');
    const user = Auth.getUser();
    if (!user) {
      document.getElementById('view').innerHTML = document.getElementById('tplLogin').innerHTML;
      document.getElementById('btnLogin').onclick = async () => {
        try {
          await Auth.loginWithGoogle();
          await boot();
        } catch (error) {
          UI.setFeedback('err', error.message);
        }
      };
      return;
    }

    try {
      await Sync.fullLoad(user.token);
      UI.setFeedback('ok', 'Dados carregados com sucesso');
    } catch (_) {
      UI.setFeedback('err', 'Modo offline ativo: usando cache local');
    }
    await UI.render();
    updateConnection();
  }

  document.addEventListener('click', async (e) => {
    const route = e.target.dataset.route;
    const action = e.target.dataset.action;

    if (route) {
      const params = { category: e.target.dataset.category };
      UI.setRoute(route, params);
      historyStack.push(route);
      return;
    }

    if (action === 'withdraw') {
      UI.setRoute('withdraw', { itemId: e.target.dataset.itemId });
      historyStack.push('withdraw');
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
      await Sync.registerWithdrawal({
        ...formData,
        quantity: Number(formData.quantity),
      }, Auth.getUser());
      UI.setFeedback('ok', 'Retirada registrada e fila atualizada');
      UI.setRoute('recent');
    } catch (err) {
      UI.setFeedback('err', err.message);
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
    await Sync.flushQueue(user);
    UI.setFeedback('ok', 'Conexão restabelecida e fila sincronizada');
    UI.render();
  });
  window.addEventListener('offline', updateConnection);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }

  document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
  boot();
})();
