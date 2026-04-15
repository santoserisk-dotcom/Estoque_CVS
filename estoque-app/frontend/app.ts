type InventoryItem = {
  categoria: string;
  nome: string;
  unidade: string;
  quantidadeAtual: number;
  minimo: number;
  rowIndex: number;
};

type Technician = {
  pin: string;
  nome: string;
};

type LogEntry = {
  timestamp: string;
  categoria: string;
  item: string;
  quantidade: number;
  unidade: string;
  patrimonios: string[];
  tecnico: string;
  observacao: string;
  estoqueAnterior: number;
  estoqueNovo: number;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  token?: string;
  tecnico?: Technician;
  error?: string;
};

const API_BASE = '/api';
const STORAGE_KEY = 'estoque_pro_recentes';
const TOKEN_KEY = 'estoque_pro_token';
const TECH_NAME_KEY = 'estoque_pro_tecnico';

let dadosEstoque: InventoryItem[] = [];
let categoriaAtual: string | null = null;
let itemAtual: InventoryItem | null = null;
let tecnicoAtual: string | null = null;
let retiradasRecentes: Array<{ item: string; quantidade: number; tecnico: string; data: string }> =
  JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

const state = {
  token: localStorage.getItem(TOKEN_KEY) || null
};

function setSyncStatus(online: boolean) {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  badge.textContent = online ? 'Online' : 'Offline';
  badge.classList.toggle('online', online);
  badge.classList.toggle('offline', !online);
}

function setPageTitle(nome: string) {
  const header = document.getElementById('tecnicoNomeHeader');
  if (header) header.textContent = nome ? `Técnico: ${nome}` : 'Acesse para começar';
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  return headers;
}

async function apiFetch<T>(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.headers || {}),
        ...getAuthHeaders()
      }
    });

    const contentType = response.headers.get('content-type') || '';
    let data: ApiResponse<T> = { success: false, error: 'Erro de comunicação.' };

    if (contentType.includes('application/json')) {
      data = (await response.json()) as ApiResponse<T>;
    } else {
      const text = await response.text();
      data.error = text || `Erro HTTP ${response.status}`;
    }

    if (!response.ok || !data.success) {
      if (response.status === 401) {
        logout();
      }
      return { success: false, error: data.error || 'Erro de comunicação.' } as ApiResponse<T>;
    }

    return data;
  } catch (error) {
    return { success: false, error: 'Erro de conexão. Verifique sua rede.' } as ApiResponse<T>;
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(retiradasRecentes));
}

function saveToken(token: string, nome: string) {
  state.token = token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TECH_NAME_KEY, nome);
  tecnicoAtual = nome;
  setPageTitle(nome);
}

function logout() {
  state.token = null;
  tecnicoAtual = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TECH_NAME_KEY);
  showScreen('loginScreen');
  setPageTitle('');
}

function setFooterVisible(visible: boolean) {
  document.querySelector('.bottom-nav')?.classList.toggle('hidden', !visible);
}

function showScreen(screenId: string) {
  document.querySelectorAll('.screen').forEach(element => element.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
  setFooterVisible(screenId !== 'loginScreen');
}

function updateNavigation(activeKey: string) {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.getAttribute('data-nav') === activeKey);
  });
}

function renderCategories() {
  const categories = Array.from(new Set(dadosEstoque.map(item => item.categoria))).filter(Boolean).sort();
  const container = document.getElementById('quickCategories');
  if (!container) return;
  container.innerHTML = categories.slice(0, 8)
    .map(categoria => `
      <div class="quick-card" data-category="${categoria}">
        <div class="quick-label">${categoria.substring(0, 20)}</div>
      </div>
    `)
    .join('');
}

function renderCriticalPreview() {
  const criticos = dadosEstoque.filter(item => item.quantidadeAtual <= item.minimo).slice(0, 5);
  const container = document.getElementById('criticalList');
  if (!container) return;

  if (criticos.length === 0) {
    container.innerHTML = '<div class="quick-card">Nenhum item crítico</div>';
    return;
  }

  container.innerHTML = criticos
    .map(item => {
      const nivel = item.quantidadeAtual === 0 ? 'ESGOTADO' : `${Math.round((item.quantidadeAtual / Math.max(item.minimo, 1)) * 100)}%`;
      return `
        <div class="critical-item" data-item="${item.nome}">
          <div>
            <div class="critical-name">${item.nome}</div>
            <div class="critical-stock">Estoque: ${item.quantidadeAtual} / Mínimo: ${item.minimo} ${item.unidade}</div>
          </div>
          <div class="critical-value ${item.quantidadeAtual === 0 ? 'danger' : ''}">${nivel}</div>
        </div>
      `;
    })
    .join('');
}

function renderDashboard() {
  const totalCategorias = Array.from(new Set(dadosEstoque.map(item => item.categoria))).filter(Boolean).length;
  const totalCriticos = dadosEstoque.filter(item => item.quantidadeAtual <= item.minimo).length;
  const totalCategoriasNode = document.getElementById('totalCategorias');
  const totalCriticosNode = document.getElementById('totalCriticos');
  if (totalCategoriasNode) totalCategoriasNode.textContent = String(totalCategorias);
  if (totalCriticosNode) totalCriticosNode.textContent = String(totalCriticos);
  renderCategories();
  renderCriticalPreview();
}

function renderItemsByCategory(categoria: string) {
  categoriaAtual = categoria;
  const container = document.getElementById('itemsContainer');
  const categoryTitle = document.getElementById('categoryTitle');
  if (categoryTitle) categoryTitle.textContent = categoria;
  if (!container) return;

  const items = dadosEstoque.filter(item => item.categoria === categoria);
  container.innerHTML = items
    .map(item => {
      const status = item.quantidadeAtual <= item.minimo ? 'Crítico' : 'Normal';
      return `
        <div class="item-card" data-item="${item.nome}">
          <div>
            <div class="item-name">${item.nome}</div>
            <div class="item-stock-mini">Estoque: ${item.quantidadeAtual} / ${item.minimo} ${item.unidade} • ${status}</div>
          </div>
          <div>→</div>
        </div>
      `;
    })
    .join('');
}

function renderSearchResults(results: InventoryItem[], targetId = 'searchResults') {
  const container = document.getElementById(targetId);
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<div class="quick-card">Nenhum item encontrado</div>';
    return;
  }

  container.innerHTML = results
    .map(item => `
      <div class="search-result-item" data-item="${item.nome}">
        <div>
          <strong>${item.nome}</strong>
          <div>Estoque: ${item.quantidadeAtual} ${item.unidade}</div>
        </div>
        <div>→</div>
      </div>
    `)
    .join('');
}

function renderRecentes() {
  const container = document.getElementById('recentesList');
  if (!container) return;
  if (retiradasRecentes.length === 0) {
    container.innerHTML = '<div class="quick-card">Nenhuma retirada recente</div>';
    return;
  }
  container.innerHTML = retiradasRecentes
    .map(entry => `
      <div class="recente-item">
        <div>
          <strong>${entry.item}</strong>
          <div>${entry.quantidade} un • ${entry.tecnico}</div>
        </div>
        <div>${entry.data}</div>
      </div>
    `)
    .join('');
}

function renderCriticosFull() {
  const container = document.getElementById('criticosList');
  if (!container) return;
  const criticos = dadosEstoque.filter(item => item.quantidadeAtual <= item.minimo);
  if (criticos.length === 0) {
    container.innerHTML = '<div class="quick-card">Nenhum item crítico</div>';
    return;
  }
  container.innerHTML = criticos
    .map(item => `
      <div class="critico-item" data-item="${item.nome}">
        <div>
          <strong>${item.nome}</strong>
          <div>Estoque: ${item.quantidadeAtual} / Mínimo: ${item.minimo} ${item.unidade}</div>
        </div>
        <div>→</div>
      </div>
    `)
    .join('');
}

function renderWithdrawalScreen(item: InventoryItem) {
  itemAtual = item;
  const itemName = document.getElementById('withdrawItemName');
  const itemStock = document.getElementById('withdrawItemStock');
  const qtdeValor = document.getElementById('qtdeValor');
  const observacao = document.getElementById('observacao') as HTMLTextAreaElement | null;
  const withdrawError = document.getElementById('withdrawError');
  const patrimoniosContainer = document.getElementById('patrimoniosContainer');

  if (itemName) itemName.textContent = item.nome;
  if (itemStock) itemStock.textContent = `Estoque atual: ${item.quantidadeAtual} ${item.unidade} | Mínimo: ${item.minimo} ${item.unidade}`;
  if (qtdeValor) qtdeValor.textContent = '1';
  if (observacao) observacao.value = '';
  if (withdrawError) withdrawError.textContent = '';

  const needsPatrimonio = ['Rádios', 'Antenas', 'Rede e Monitoramento', 'Energia'].includes(item.categoria) && item.unidade === 'un';
  if (patrimoniosContainer) {
    patrimoniosContainer.style.display = needsPatrimonio ? 'block' : 'none';
  }
  if (needsPatrimonio) {
    renderPatrimonios(1);
  }
}

function renderPatrimonios(count: number) {
  const container = document.getElementById('patrimoniosList');
  if (!container) return;
  container.innerHTML = Array.from({ length: count })
    .map((_, index) => `
      <div class="patrimonio-input">
        <input type="text" placeholder="Patrimônio ${index + 1}" />
        <button class="remove-patrimonio" type="button">✖</button>
      </div>
    `)
    .join('');
}

function getQuantityValue(): number {
  const qtdeValor = document.getElementById('qtdeValor');
  if (!qtdeValor) return 1;
  return Math.max(1, Number(qtdeValor.textContent) || 1);
}

function updateQuantity(delta: number) {
  const qtdeValor = document.getElementById('qtdeValor');
  if (!qtdeValor) return;
  let newValue = getQuantityValue() + delta;
  if (itemAtual) {
    newValue = Math.min(Math.max(newValue, 1), itemAtual.quantidadeAtual);
  }
  qtdeValor.textContent = String(newValue);

  const patrimoniosContainer = document.getElementById('patrimoniosContainer');
  if (patrimoniosContainer && patrimoniosContainer.style.display === 'block') {
    renderPatrimonios(newValue);
  }
}

function collectPatrimonios(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('#patrimoniosList input'))
    .map(input => input.value.trim())
    .filter(Boolean);
}

async function confirmRetirada() {
  const errorDiv = document.getElementById('withdrawError');
  if (errorDiv) errorDiv.textContent = '';
  if (!itemAtual || !tecnicoAtual) return;

  const quantidade = getQuantityValue();
  const observacao = (document.getElementById('observacao') as HTMLTextAreaElement | null)?.value || '';
  const patrimonios = collectPatrimonios();
  const needsPatrimonio = ['Rádios', 'Antenas', 'Rede e Monitoramento', 'Energia'].includes(itemAtual.categoria) && itemAtual.unidade === 'un';

  if (needsPatrimonio && patrimonios.length !== quantidade) {
    if (errorDiv) errorDiv.textContent = `Informe exatamente ${quantidade} patrimônio(s).`;
    return;
  }

  if (needsPatrimonio && patrimonios.some(p => p.length === 0)) {
    if (errorDiv) errorDiv.textContent = 'Preencha todos os patrimônios.';
    return;
  }

  const button = document.getElementById('btnConfirmar');
  if (button) {
    button.textContent = 'Processando...';
    button.setAttribute('disabled', 'true');
  }

  const result = await apiFetch<{ item: string; quantidade: number; estoqueNovo: number }>('/retirada', {
    method: 'POST',
    body: JSON.stringify({
      itemNome: itemAtual.nome,
      quantidade,
      tecnico: tecnicoAtual,
      observacao,
      patrimonios
    })
  });

  if (button) {
    button.textContent = 'Confirmar retirada';
    button.removeAttribute('disabled');
  }

  if (!result.success) {
    if (errorDiv) errorDiv.textContent = result.error || 'Falha ao registrar retirada.';
    return;
  }

  retiradasRecentes.unshift({
    item: itemAtual.nome,
    quantidade,
    tecnico: tecnicoAtual,
    data: new Date().toLocaleString()
  });
  if (retiradasRecentes.length > 20) {
    retiradasRecentes.pop();
  }
  saveLocalState();
  await loadInventory();
  showScreen('mainScreen');
  updateNavigation('home');
}

async function loadInventory() {
  const result = await apiFetch<{ items: InventoryItem[] }>('/estoque');
  if (!result.success || !result.data) {
    setSyncStatus(false);
    return;
  }
  setSyncStatus(true);
  dadosEstoque = result.data.items;
  renderDashboard();
}

function attachEvents() {
  document.getElementById('btnLogin')?.addEventListener('click', login);
  document.getElementById('togglePassword')?.addEventListener('click', () => {
    const input = document.getElementById('senhaEquipe') as HTMLInputElement | null;
    const button = document.getElementById('togglePassword');
    if (!input || !button) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ocultar' : 'Ver';
    button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  });
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    logout();
    updateNavigation('home');
  });
  document.getElementById('btnConfirmar')?.addEventListener('click', confirmRetirada);
  document.getElementById('qtdeMenos')?.addEventListener('click', () => updateQuantity(-1));
  document.getElementById('qtdeMais')?.addEventListener('click', () => updateQuantity(1));

  document.getElementById('backToHomeFromItems')?.addEventListener('click', () => {
    showScreen('mainScreen');
    updateNavigation('home');
  });
  document.getElementById('backToHomeFromWithdraw')?.addEventListener('click', () => {
    showScreen('mainScreen');
    updateNavigation('home');
  });
  document.getElementById('backToHomeFromSearch')?.addEventListener('click', () => {
    showScreen('mainScreen');
    updateNavigation('home');
  });
  document.getElementById('backToHomeFromRecentes')?.addEventListener('click', () => {
    showScreen('mainScreen');
    updateNavigation('home');
  });
  document.getElementById('backToHomeFromCriticos')?.addEventListener('click', () => {
    showScreen('mainScreen');
    updateNavigation('home');
  });

  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      if (!state.token) {
        showScreen('loginScreen');
        updateNavigation('home');
        return;
      }

      const route = button.getAttribute('data-nav');
      if (route === 'home') {
        showScreen('mainScreen');
      }
      if (route === 'search') {
        showScreen('searchScreen');
      }
      if (route === 'recentes') {
        renderRecentes();
        showScreen('recentesScreen');
      }
      if (route === 'criticos') {
        renderCriticosFull();
        showScreen('criticosScreen');
      }
      updateNavigation(route || 'home');
    });
  });

  document.getElementById('searchInput')?.addEventListener('input', event => {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    const resultArea = 'homeSearchResults';
    if (value.length < 2) {
      renderCategories();
      const homeResults = document.getElementById(resultArea);
      if (homeResults) homeResults.innerHTML = '';
      return;
    }
    const results = dadosEstoque.filter(item => item.nome.toLowerCase().includes(value));
    renderSearchResults(results, resultArea);
  });

  document.getElementById('globalSearchInput')?.addEventListener('input', event => {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    if (value.length < 2) {
      renderSearchResults([]);
      return;
    }
    const results = dadosEstoque.filter(item => item.nome.toLowerCase().includes(value));
    renderSearchResults(results);
  });

  document.getElementById('quickCategories')?.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest('[data-category]') as HTMLElement | null;
    if (!target) return;
    const category = target.dataset.category;
    if (!category) return;
    renderItemsByCategory(category);
    showScreen('itemsScreen');
    updateNavigation('home');
  });

  document.getElementById('itemsContainer')?.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
    if (!target) return;
    const itemName = target.dataset.item;
    const item = dadosEstoque.find(i => i.nome === itemName);
    if (!item) return;
    renderWithdrawalScreen(item);
    showScreen('withdrawScreen');
  });

  document.querySelectorAll('#searchResults, #homeSearchResults').forEach(container => {
    container.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
      if (!target) return;
      const itemName = target.dataset.item;
      const item = dadosEstoque.find(i => i.nome === itemName);
      if (!item) return;
      renderWithdrawalScreen(item);
      showScreen('withdrawScreen');
    });
  });

  document.getElementById('criticalList')?.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
    if (!target) return;
    const itemName = target.dataset.item;
    const item = dadosEstoque.find(i => i.nome === itemName);
    if (!item) return;
    renderWithdrawalScreen(item);
    showScreen('withdrawScreen');
  });

  document.getElementById('criticosList')?.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
    if (!target) return;
    const itemName = target.dataset.item;
    const item = dadosEstoque.find(i => i.nome === itemName);
    if (!item) return;
    renderWithdrawalScreen(item);
    showScreen('withdrawScreen');
  });
}

async function login() {
  const senha = (document.getElementById('senhaEquipe') as HTMLInputElement).value;
  const pin = (document.getElementById('pinTecnico') as HTMLInputElement).value;
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) errorDiv.textContent = '';

  const response = await apiFetch<{ token: string; tecnico: Technician }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ senha, pin })
  });

  if (!response.success || !response.token || !response.tecnico) {
    if (errorDiv) errorDiv.textContent = response.error || 'Falha no login.';
    return;
  }

  saveToken(response.token, response.tecnico.nome);
  await loadInventory();
  showScreen('mainScreen');
  updateNavigation('home');
}

function loadStoredTechnician() {
  const savedName = localStorage.getItem(TECH_NAME_KEY);
  if (savedName) {
    tecnicoAtual = savedName;
    setPageTitle(savedName);
  }
}

async function init() {
  loadStoredTechnician();
  attachEvents();
  if (state.token) {
    await loadInventory();
    if (state.token) {
      showScreen('mainScreen');
      updateNavigation('home');
    } else {
      showScreen('loginScreen');
    }
  } else {
    showScreen('loginScreen');
  }
  setSyncStatus(false);
}

init();
