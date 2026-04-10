(() => {
  const state = {
    route: 'home',
    category: null,
    itemId: null,
    feedback: null,
    query: '',
  };

  const view = () => document.getElementById('view');

  function setFeedback(type, message) {
    state.feedback = { type, message };
    setTimeout(() => { state.feedback = null; render(); }, 3500);
  }

  function feedbackTpl() {
    if (!state.feedback) return '';
    return `<div class="feedback ${state.feedback.type}">${state.feedback.message}</div>`;
  }

  function cardItem(item, actionLabel = 'Retirar') {
    return `<div class="item-row">
      <div>
        <strong>${item.name}</strong>
        <div class="meta">${item.code} • saldo: ${item.stock} • tipo: ${item.type}</div>
      </div>
      <button data-item-id="${item.id}" data-action="withdraw">${actionLabel}</button>
    </div>`;
  }

  function renderHome() {
    const tpl = document.getElementById('tplHome');
    return `${feedbackTpl()}${tpl.innerHTML}`;
  }

  async function renderCategories() {
    const items = await DB.getAllItems();
    const groups = [...new Set(items.map((i) => i.category))].sort();
    return `${feedbackTpl()}<section class="list">${groups
      .map((g) => `<button class="tile" data-route="items" data-category="${g}"><h2>${g}</h2></button>`)
      .join('')}</section>`;
  }

  async function renderItemsByCategory(category) {
    const items = (await DB.getAllItems()).filter((i) => i.category === category);
    return `${feedbackTpl()}<section class="stack"><div class="card"><strong>${category}</strong></div><div class="list">${items
      .map((i) => cardItem(i))
      .join('')}</div></section>`;
  }

  async function renderSearch() {
    const q = state.query.trim().toLowerCase();
    const items = await DB.getAllItems();
    const filtered = !q
      ? []
      : items.filter((i) => `${i.name} ${i.code}`.toLowerCase().includes(q));
    return `${feedbackTpl()}<section class="stack"><input id="searchInput" class="input" placeholder="Buscar por nome/código" value="${state.query}" />
      <div class="list">${filtered.map((i) => cardItem(i)).join('') || '<p class="help">Digite para pesquisar.</p>'}</div>
    </section>`;
  }

  async function renderRecent() {
    const recent = (await DB.recentAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
    return `${feedbackTpl()}<section class="list">${recent
      .map((r) => `<div class="card"><strong>${r.itemName}</strong><div class="meta">${r.quantity} un • ${new Date(r.createdAt).toLocaleString()}</div></div>`)
      .join('') || '<p class="help">Sem histórico local ainda.</p>'}</section>`;
  }

  async function renderCritical() {
    const items = (await DB.getAllItems()).filter((i) => Number(i.stock) <= Number(i.minStock || 0));
    return `${feedbackTpl()}<section class="list">${items.map((i) => cardItem(i, 'Retirar')).join('') || '<p class="help">Sem alertas.</p>'}</section>`;
  }

  async function renderWithdraw(itemId) {
    const item = (await DB.getAllItems()).find((i) => i.id === itemId);
    if (!item) return '<p>Item não encontrado.</p>';
    return `${feedbackTpl()}<section class="card stack">
      <h2>${item.name}</h2>
      <p class="meta">Saldo atual: ${item.stock}</p>
      <form id="withdrawForm" class="form">
        <input type="hidden" name="itemId" value="${item.id}" />
        <input type="hidden" name="itemName" value="${item.name}" />
        <label>Quantidade <input class="input" name="quantity" type="number" min="1" required /></label>
        <label>Técnico <input class="input" name="technician" required value="${Auth.getUser()?.email || ''}" /></label>
        <label>Patrimônios (1 por linha, quando aplicável)
          <textarea name="assets" rows="3" placeholder="Ex: PAT-001"></textarea>
        </label>
        <label>Observação <textarea name="note" rows="2"></textarea></label>
        <button class="btn primary" type="submit">Confirmar retirada</button>
      </form>
    </section>`;
  }

  async function render() {
    const root = view();
    root.classList.remove('slide-in');
    let html = '';
    switch (state.route) {
      case 'home': html = renderHome(); break;
      case 'categories': html = await renderCategories(); break;
      case 'items': html = await renderItemsByCategory(state.category); break;
      case 'search': html = await renderSearch(); break;
      case 'recent': html = await renderRecent(); break;
      case 'critical': html = await renderCritical(); break;
      case 'withdraw': html = await renderWithdraw(state.itemId); break;
      default: html = renderHome();
    }
    root.innerHTML = html;
    requestAnimationFrame(() => root.classList.add('slide-in'));
  }

  function setRoute(route, params = {}) {
    state.route = route;
    if (params.category) state.category = params.category;
    if (params.itemId) state.itemId = params.itemId;
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.textContent = ['home', route].filter((v, i, a) => a.indexOf(v) === i).join(' › ');
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.route === route));
    render();
  }

  window.UI = { state, render, setRoute, setFeedback };
})();
