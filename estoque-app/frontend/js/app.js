import { login, fetchInventory, fetchCriticalItems, fetchLogs, postRetirada, saveToken, getStoredToken } from './api.js';
import { saveCache, getCachedData, saveMetadata, getMetadata, getPendingCount } from './cache.js';
import { addPendingRetirada, applyLocalStockUpdate } from './offline.js';
import { syncPendingRetiradas } from './sync.js';

const STORAGE_TECHNICIAN = 'estoque_tecnico';

const state = {
  token: getStoredToken(),
  tecnico: getTechnician(),
  inventory: [],
  criticalItems: [],
  logs: [],
  selectedItem: null,
  quantity: 1,
  pendingCount: 0,
  lastSync: null,
  usingCache: false
};

const elements = {
  screens: document.querySelectorAll('.screen'),
  navButtons: document.querySelectorAll('.nav-item'),
  loginScreen: document.getElementById('loginScreen'),
  mainScreen: document.getElementById('mainScreen'),
  itemsScreen: document.getElementById('itemsScreen'),
  withdrawScreen: document.getElementById('withdrawScreen'),
  searchScreen: document.getElementById('searchScreen'),
  recentesScreen: document.getElementById('recentesScreen'),
  criticosScreen: document.getElementById('criticosScreen'),
  tecnicoNomeHeader: document.getElementById('tecnicoNomeHeader'),
  loginError: document.getElementById('loginError'),
  senhaEquipe: document.getElementById('senhaEquipe'),
  pinTecnico: document.getElementById('pinTecnico'),
  btnLogin: document.getElementById('btnLogin'),
  togglePassword: document.getElementById('togglePassword'),
  btnSync: document.getElementById('btnSync'),
  syncDetails: document.getElementById('syncDetails'),
  totalCategorias: document.getElementById('totalCategorias'),
  totalCriticos: document.getElementById('totalCriticos'),
  quickCategories: document.getElementById('quickCategories'),
  criticalList: document.getElementById('criticalList'),
  homeSearchInput: document.getElementById('searchInput'),
  homeSearchResults: document.getElementById('homeSearchResults'),
  btnViewAllCriticos: document.getElementById('btnViewAllCriticos'),
  backToHomeFromItems: document.getElementById('backToHomeFromItems'),
  categoryTitle: document.getElementById('categoryTitle'),
  itemsContainer: document.getElementById('itemsContainer'),
  backToHomeFromWithdraw: document.getElementById('backToHomeFromWithdraw'),
  withdrawItemName: document.getElementById('withdrawItemName'),
  withdrawItemStock: document.getElementById('withdrawItemStock'),
  qtdeMenos: document.getElementById('qtdeMenos'),
  qtdeMais: document.getElementById('qtdeMais'),
  qtdeValor: document.getElementById('qtdeValor'),
  patrimoniosContainer: document.getElementById('patrimoniosContainer'),
  patrimoniosList: document.getElementById('patrimoniosList'),
  observacao: document.getElementById('observacao'),
  btnConfirmar: document.getElementById('btnConfirmar'),
  withdrawError: document.getElementById('withdrawError'),
  globalSearchInput: document.getElementById('globalSearchInput'),
  searchResults: document.getElementById('searchResults'),
  backToHomeFromSearch: document.getElementById('backToHomeFromSearch'),
  recentesList: document.getElementById('recentesList'),
  backToHomeFromRecentes: document.getElementById('backToHomeFromRecentes'),
  criticosList: document.getElementById('criticosList'),
  backToHomeFromCriticos: document.getElementById('backToHomeFromCriticos')
};

function getTechnician() {
  const raw = localStorage.getItem(STORAGE_TECHNICIAN);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveTechnician(tecnico) {
  localStorage.setItem(STORAGE_TECHNICIAN, JSON.stringify(tecnico));
}

function clearAuthentication() {
  localStorage.removeItem(STORAGE_TECHNICIAN);
  localStorage.removeItem('estoque_pro_token');
  state.token = null;
  state.tecnico = null;
}

function showScreen(name) {
  const screenKey = name === 'home' ? 'main' : name;
  elements.screens.forEach(screen => {
    screen.classList.toggle('active', screen.id === `${screenKey}Screen`);
  });

  elements.navButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.nav === name);
  });
}

function displayLoginError(message) {
  elements.loginError.textContent = message || '';
}

function displayWithdrawError(message) {
  elements.withdrawError.textContent = message || '';
}

function updateTechnicalHeader() {
  if (state.tecnico && state.tecnico.nome) {
    elements.tecnicoNomeHeader.textContent = `Bem-vindo, ${state.tecnico.nome}`;
  } else {
    elements.tecnicoNomeHeader.textContent = 'Acesse para começar';
  }
}

function setSyncDetailsText() {
  const pending = state.pendingCount || 0;
  const lastSync = state.lastSync ? new Date(state.lastSync).toLocaleString('pt-BR') : '-';
  elements.syncDetails.textContent = `Última sync: ${lastSync} | Pendentes: ${pending}`;
}

async function refreshPendingState() {
  state.pendingCount = await getPendingCount();
  state.lastSync = await getMetadata('lastSync');
  setSyncDetailsText();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      console.warn('Não foi possível registrar o service worker.');
    });
  }
}

async function handleLogin() {
  displayLoginError('');

  const senha = elements.senhaEquipe.value.trim();
  const pin = elements.pinTecnico.value.trim();

  if (!senha || !pin) {
    displayLoginError('Preencha senha e PIN antes de continuar.');
    return;
  }

  const result = await login(senha, pin);
  if (!result.success) {
    displayLoginError(result.error || 'Erro ao autenticar.');
    return;
  }

  saveToken(result.token);
  saveTechnician(result.tecnico);
  state.token = result.token;
  state.tecnico = result.tecnico;
  updateTechnicalHeader();
  await refreshPendingState();
  await loadHomeData();
  showScreen('home');
}

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function getFilteredItems(query) {
  const normalized = normalizeQuery(query);
  if (!normalized || normalized.length < 2) return [];
  return state.inventory.filter(item =>
    item.nome.toLowerCase().includes(normalized) || item.categoria.toLowerCase().includes(normalized)
  );
}

function createListItem(item) {
  const card = document.createElement('button');
  card.className = 'result-item';
  card.type = 'button';
  card.textContent = `${item.nome} • ${item.categoria}`;
  card.addEventListener('click', () => showWithdrawScreen(item));
  return card;
}

function renderSearchResults(container, query) {
  container.innerHTML = '';
  const results = getFilteredItems(query).slice(0, 8);
  if (!results.length) {
    const message = document.createElement('p');
    message.className = 'empty-state';
    message.textContent = query.length < 2 ? 'Digite pelo menos 2 caracteres para buscar.' : 'Nenhum item encontrado.';
    container.appendChild(message);
    return;
  }
  results.forEach(item => container.appendChild(createListItem(item)));
}

function categorizeInventory() {
  const categories = new Map();
  state.inventory.forEach(item => {
    const key = item.categoria || 'Sem categoria';
    if (!categories.has(key)) {
      categories.set(key, []);
    }
    categories.get(key).push(item);
  });
  return categories;
}

function renderMetrics() {
  const categoriesCount = new Set(state.inventory.map(item => item.categoria)).size;
  elements.totalCategorias.textContent = categoriesCount.toString();
  elements.totalCriticos.textContent = state.criticalItems.length.toString();
}

function renderQuickCategories() {
  elements.quickCategories.innerHTML = '';
  const categories = categorizeInventory();
  Array.from(categories.keys()).slice(0, 8).forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill-button';
    button.textContent = category;
    button.addEventListener('click', () => showCategoryItems(category));
    elements.quickCategories.appendChild(button);
  });
}

function renderCriticalList() {
  elements.criticalList.innerHTML = '';
  const items = state.criticalItems.slice(0, 4);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhum item crítico no momento.';
    elements.criticalList.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'critical-item';
    card.innerHTML = `<span>${item.nome}</span><strong>${item.quantidadeAtual} ${item.unidade}</strong>`;
    card.addEventListener('click', () => showWithdrawScreen(item));
    elements.criticalList.appendChild(card);
  });
}

function renderCategoryItems(category) {
  const items = state.inventory.filter(item => item.categoria === category);
  elements.itemsContainer.innerHTML = '';
  elements.categoryTitle.textContent = category;
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhum item encontrado nesta categoria.';
    elements.itemsContainer.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-card';
    row.innerHTML = `<span>${item.nome}</span><strong>${item.quantidadeAtual} ${item.unidade}</strong>`;
    row.addEventListener('click', () => showWithdrawScreen(item));
    elements.itemsContainer.appendChild(row);
  });
}

function renderCriticosScreen() {
  elements.criticosList.innerHTML = '';
  if (!state.criticalItems.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhum item crítico para exibir.';
    elements.criticosList.appendChild(empty);
    return;
  }
  state.criticalItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div>
        <strong>${item.nome}</strong>
        <span>${item.categoria}</span>
      </div>
      <span>${item.quantidadeAtual} ${item.unidade}</span>
    `;
    row.addEventListener('click', () => showWithdrawScreen(item));
    elements.criticosList.appendChild(row);
  });
}

async function renderRecentesScreen() {
  elements.recentesList.innerHTML = '';
  if (!state.logs.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Sem retiradas recentes disponíveis.';
    elements.recentesList.appendChild(empty);
    return;
  }
  state.logs.slice(0, 20).forEach(log => {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div>
        <strong>${log.item}</strong>
        <span>${log.categoria}</span>
      </div>
      <div class="history-meta">
        <span>${log.quantidade} ${log.unidade}</span>
        <span>${new Date(log.timestamp).toLocaleString('pt-BR')}</span>
      </div>
    `;
    elements.recentesList.appendChild(row);
  });
}

function showCategoryItems(category) {
  renderCategoryItems(category);
  showScreen('items');
}

function showWithdrawScreen(item) {
  state.selectedItem = item;
  state.quantity = 1;
  elements.withdrawError.textContent = '';
  elements.observacao.value = '';
  elements.withdrawItemName.textContent = item.nome;
  elements.withdrawItemStock.textContent = `${item.quantidadeAtual} ${item.unidade} disponíveis`;
  elements.qtdeValor.textContent = '1';
  renderPatrimonioFields();
  showScreen('withdraw');
}

function itemRequiresPatrimony(item) {
  return ['Rádios', 'Antenas', 'Rede e Monitoramento', 'Energia'].includes(item.categoria) && item.unidade === 'un';
}

function renderPatrimonioFields() {
  const item = state.selectedItem;
  if (!item || !itemRequiresPatrimony(item)) {
    elements.patrimoniosContainer.classList.add('hidden');
    elements.patrimoniosList.innerHTML = '';
    return;
  }

  elements.patrimoniosContainer.classList.remove('hidden');
  const quantity = state.quantity;
  elements.patrimoniosList.innerHTML = '';
  for (let index = 0; index < quantity; index++) {
    const field = document.createElement('label');
    field.className = 'field-label';
    field.innerHTML = `
      <span>Patrimônio ${index + 1}</span>
      <input type="text" class="patrimonio-input" autocomplete="off" placeholder="000000" />
    `;
    elements.patrimoniosList.appendChild(field);
  }
}

function getPatrimonios() {
  return Array.from(elements.patrimoniosList.querySelectorAll('.patrimonio-input'))
    .map(input => input.value.trim())
    .filter(Boolean);
}

async function handleConfirmRetirada() {
  displayWithdrawError('');
  const item = state.selectedItem;
  if (!item) {
    displayWithdrawError('Nenhum item selecionado.');
    return;
  }

  const quantity = state.quantity;
  if (quantity < 1 || quantity > item.quantidadeAtual) {
    displayWithdrawError('Quantidade inválida.');
    return;
  }

  const observacao = elements.observacao.value.trim();
  const patrimonios = itemRequiresPatrimony(item) ? getPatrimonios() : [];

  if (itemRequiresPatrimony(item) && patrimonios.length !== quantity) {
    displayWithdrawError(`Informe exatamente ${quantity} patrimônio(s).`);
    return;
  }

  const payload = {
    itemNome: item.nome,
    quantidade,
    tecnico: state.tecnico.nome,
    observacao,
    patrimonios
  };

  if (!navigator.onLine) {
    await addPendingRetirada({
      id: `${Date.now()}-${item.nome}`,
      token: state.token,
      data: payload
    });
    await applyLocalStockUpdate(item.nome, quantity);
    state.pendingCount = await getPendingCount();
    await saveMetadata('pendingCount', state.pendingCount);
    setSyncDetailsText();
    showScreen('home');
    await loadHomeData({useCacheOnly: true});
    displayGlobalAlert('Retirada salva offline. Sincronize quando voltar à internet.');
    return;
  }

  const result = await postRetirada(payload, state.token);
  if (!result.success) {
    displayWithdrawError(result.error || 'Erro ao confirmar retirada.');
    return;
  }

  await loadHomeData();
  showScreen('home');
  displayGlobalAlert('Retirada registrada com sucesso.');
}

function displayGlobalAlert(message) {
  const alert = document.createElement('div');
  alert.className = 'toast-message';
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => { alert.classList.add('visible'); }, 20);
  setTimeout(() => { alert.classList.remove('visible'); setTimeout(() => alert.remove(), 300); }, 3000);
}

async function handleSync() {
  await refreshPendingState();
  if (!navigator.onLine) {
    displayGlobalAlert('Conexão offline. Sincronização só funciona online.');
    return;
  }
  await syncPendingRetiradas(status => {
    state.lastSync = new Date().toISOString();
    setSyncDetailsText();
    displayGlobalAlert(status);
  });
  await refreshPendingState();
  await loadHomeData();
}

async function loadHomeData(options = {}) {
  const useCacheOnly = options.useCacheOnly === true;
  let inventoryResponse;
  let criticalResponse;
  let logsResponse;

  const online = navigator.onLine;

  if (online && !useCacheOnly) {
    inventoryResponse = await fetchInventory();
    criticalResponse = await fetchCriticalItems();
    logsResponse = await fetchLogs();
  }

  if (inventoryResponse?.success && criticalResponse?.success) {
    state.inventory = inventoryResponse.data.items || [];
    state.criticalItems = criticalResponse.data.criticos || [];
    state.usingCache = false;
    await saveCache({ items: state.inventory, criticalItems: state.criticalItems });
    await saveMetadata('lastSync', new Date().toISOString());
    if (logsResponse?.success) {
      state.logs = logsResponse.data.logs || [];
    }
  } else {
    const cached = await getCachedData();
    if (cached?.items) {
      state.inventory = cached.items;
      state.criticalItems = cached.criticalItems || [];
      state.usingCache = true;
    }
    if (logsResponse?.success) {
      state.logs = logsResponse.data.logs || [];
    }
  }

  renderMetrics();
  renderQuickCategories();
  renderCriticalList();
  if (elements.searchResults) renderSearchResults(elements.searchResults, elements.globalSearchInput.value.trim());
  await refreshPendingState();
}

function handleHomeSearch() {
  renderSearchResults(elements.homeSearchResults, elements.homeSearchInput.value);
}

function handleGlobalSearch() {
  renderSearchResults(elements.searchResults, elements.globalSearchInput.value);
}

function setupEventListeners() {
  if (elements.btnLogin) {
    elements.btnLogin.addEventListener('click', handleLogin);
  } else {
    console.warn('Login button not found');
  }

  if (elements.togglePassword) {
    elements.togglePassword.addEventListener('click', () => {
      const input = elements.senhaEquipe;
      const button = elements.togglePassword;
      if (!input || !button) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      button.classList.toggle('active', show);
    });
  }

  if (elements.btnSync) {
    elements.btnSync.addEventListener('click', handleSync);
  }
  if (elements.homeSearchInput) {
    elements.homeSearchInput.addEventListener('input', handleHomeSearch);
  }
  if (elements.globalSearchInput) {
    elements.globalSearchInput.addEventListener('input', handleGlobalSearch);
  }
  if (elements.btnViewAllCriticos) {
    elements.btnViewAllCriticos.addEventListener('click', () => showScreen('criticos'));
  }
  if (elements.backToHomeFromItems) {
    elements.backToHomeFromItems.addEventListener('click', () => showScreen('home'));
  }
  if (elements.backToHomeFromWithdraw) {
    elements.backToHomeFromWithdraw.addEventListener('click', () => showScreen('home'));
  }
  if (elements.backToHomeFromSearch) {
    elements.backToHomeFromSearch.addEventListener('click', () => showScreen('home'));
  }
  if (elements.backToHomeFromRecentes) {
    elements.backToHomeFromRecentes.addEventListener('click', () => showScreen('home'));
  }
  if (elements.backToHomeFromCriticos) {
    elements.backToHomeFromCriticos.addEventListener('click', () => showScreen('home'));
  }
  if (elements.btnConfirmar) {
    elements.btnConfirmar.addEventListener('click', handleConfirmRetirada);
  }
  if (elements.qtdeMais) {
    elements.qtdeMais.addEventListener('click', () => {
      const item = state.selectedItem;
      if (!item) return;
      state.quantity = Math.min(item.quantidadeAtual, state.quantity + 1);
      elements.qtdeValor.textContent = state.quantity.toString();
      renderPatrimonioFields();
    });
  }
  if (elements.qtdeMenos) {
    elements.qtdeMenos.addEventListener('click', () => {
      if (state.quantity <= 1) return;
      state.quantity -= 1;
      elements.qtdeValor.textContent = state.quantity.toString();
      renderPatrimonioFields();
    });
  }

  elements.navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.nav;
      if (target === 'home') {
        showScreen('home');
        return;
      }
      if (target === 'recentes') {
        renderRecentesScreen();
      }
      if (target === 'criticos') {
        renderCriticosScreen();
      }
      showScreen(target);
    });
  });

  window.addEventListener('online', async () => {
    displayGlobalAlert('Conexão restabelecida. Sincronizando dados...');
    await handleSync();
  });

  window.addEventListener('offline', () => {
    displayGlobalAlert('Você está offline. Algumas funções ficam indisponíveis.');
  });
}

async function initApp() {
  registerServiceWorker();
  setupEventListeners();
  updateTechnicalHeader();
  await refreshPendingState();

  if (state.token && state.tecnico) {
    await loadHomeData();
    showScreen('home');
  } else {
    clearAuthentication();
    showScreen('login');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
