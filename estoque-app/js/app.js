  // ============================================
  // CONFIGURAÇÃO DA API
  // ============================================
  const API_URL = 'http://localhost:3001/macros/s/AKfycbw9VotGc7h8_yHh7I2IkM8K5en6lSE1e1fpDMQta9RdAMZo8H6Cu-tFpKgyW9ODQ1eM/exec';

  // ============================================
  // ESTADO GLOBAL
  // ============================================
  let dadosEstoque = [];
  let categoriasLista = [];
  let categoriaAtual = null;
  let itemAtual = null;
  let tecnicoAtual = null;
  let retiradasRecentes = JSON.parse(localStorage.getItem('retiradasRecentes') || '[]');
  let telaAnterior = 'mainScreen';

  // ============================================
  // FUNÇÕES AUXILIARES (definidas antes de carregarEstoque)
  // ============================================
  function processarCategorias() {
    const cats = new Set();
    dadosEstoque.forEach(item => {
      if (item[0]) cats.add(item[0]);
    });
    categoriasLista = Array.from(cats).sort();
    const totalCategorias = document.getElementById('totalCategorias');
    if (totalCategorias) totalCategorias.textContent = categoriasLista.length;
  }

  function carregarMetricas() {
    const criticos = dadosEstoque.filter(item => {
      const atual = Number(item[3]) || 0;
      const minimo = Number(item[4]) || 0;
      return atual <= minimo && atual > 0;
    });
    const totalCriticos = document.getElementById('totalCriticos');
    if (totalCriticos) totalCriticos.textContent = criticos.length;
  }

  function atualizarStatusSync(online) {
    const dot = document.querySelector('.sync-dot');
    const text = document.querySelector('.sync-text');
    const badge = document.getElementById('syncBadge');
    const lastSyncSpan = document.getElementById('lastSync');
    
    if (online) {
      if (dot) {
        dot.classList.remove('offline');
        dot.classList.add('online');
      }
      if (text) text.textContent = 'Online';
      if (badge) badge.textContent = 'Online';
      if (lastSyncSpan) lastSyncSpan.textContent = new Date().toLocaleString();
    } else {
      if (dot) {
        dot.classList.remove('online');
        dot.classList.add('offline');
      }
      if (text) text.textContent = 'Offline';
      if (badge) badge.textContent = 'Offline';
    }
  }

  function carregarCategoriasRapidas() {
    const principais = categoriasLista.slice(0, 8);
    const container = document.getElementById('quickCategories');
    if (!container) return;
    
    container.innerHTML = principais.map(cat => `
      <div class="quick-card" onclick="abrirCategoria('${cat.replace(/'/g, "\\'")}')">
        <div class="quick-label">${cat.substring(0, 14)}</div>
      </div>
    `).join('');
  }

  function carregarListaCritica() {
    const criticos = dadosEstoque.filter(item => {
      const atual = Number(item[3]) || 0;
      const minimo = Number(item[4]) || 0;
      return atual <= minimo;
    }).slice(0, 5);
    
    const container = document.getElementById('criticalList');
    if (!container) return;
    
    if (criticos.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#718096;">Nenhum item crítico</div>';
      return;
    }
    
    container.innerHTML = criticos.map(item => {
      const atual = Number(item[3]) || 0;
      const minimo = Number(item[4]) || 0;
      const isZerado = atual === 0;
      
      return `
        <div class="critical-item ${isZerado ? '' : 'warning'}" onclick="abrirRetirada('${item[1].replace(/'/g, "\\'")}')">
          <div>
            <div class="critical-name">${item[1]}</div>
            <div class="critical-stock">Estoque: ${atual} / Mínimo: ${minimo} ${item[2]}</div>
          </div>
          <div class="critical-value ${isZerado ? 'danger' : ''}">${isZerado ? 'ESGOTADO' : Math.round((atual/minimo)*100) + '%'}</div>
        </div>
      `;
    }).join('');
  }

  // ============================================
  // FUNÇÕES DE API
  // ============================================
  async function apiGetTecnicos() {
    try {
      const response = await fetch(`${API_URL}?action=getTecnicos`);
      const resultado = await response.json();
      return resultado;
    } catch (error) {
      console.error('Erro ao buscar técnicos:', error);
      return { success: false, error: error.message };
    }
  }

  async function apiGetEstoque() {
    try {
      const response = await fetch(`${API_URL}?action=getEstoque`);
      const resultado = await response.json();
      return resultado;
    } catch (error) {
      console.error('Erro ao buscar estoque:', error);
      return { success: false, error: error.message };
    }
  }

  async function apiRegistrarRetirada(data) {
    console.log('📤 Enviando retirada:', data);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao registrar retirada:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // CARREGAR ESTOQUE (com cache)
  // ============================================
  async function carregarEstoque(forceRefresh = false) {
    const CACHE_KEY = 'estoqueCache';
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY) {
            console.log('✅ Usando cache do estoque');
            dadosEstoque = data;
            processarCategorias();
            carregarMetricas();
            carregarCategoriasRapidas();
            carregarListaCritica();
            atualizarStatusSync(true);
            return true;
          }
        } catch (e) {
          console.warn('Erro ao ler cache:', e);
        }
      }
    }

    console.log('🔄 Buscando estoque da API...');
    const resultado = await apiGetEstoque();
    if (resultado.success) {
      dadosEstoque = resultado.data.items;
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: dadosEstoque,
        timestamp: Date.now()
      }));
      processarCategorias();
      carregarMetricas();
      carregarCategoriasRapidas();
      carregarListaCritica();
      atualizarStatusSync(true);
      return true;
    } else {
      console.error('Erro ao carregar estoque:', resultado.error);
      atualizarStatusSync(false);
      return false;
    }
  }

  // ============================================
  // NAVEGAÇÃO
  // ============================================
  function mostrarTelaPrincipal() {
    const mainScreen = document.getElementById('mainScreen');
    const loginScreen = document.getElementById('loginScreen');
    const itemsScreen = document.getElementById('itemsScreen');
    const withdrawScreen = document.getElementById('withdrawScreen');
    const searchScreen = document.getElementById('searchScreen');
    const recentesScreen = document.getElementById('recentesScreen');
    const criticosScreen = document.getElementById('criticosScreen');
    
    if (mainScreen) mainScreen.classList.add('active');
    if (loginScreen) loginScreen.classList.remove('active');
    if (itemsScreen) itemsScreen.classList.remove('active');
    if (withdrawScreen) withdrawScreen.classList.remove('active');
    if (searchScreen) searchScreen.classList.remove('active');
    if (recentesScreen) recentesScreen.classList.remove('active');
    if (criticosScreen) criticosScreen.classList.remove('active');
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const homeNav = document.querySelector('.nav-item[data-nav="home"]');
    if (homeNav) homeNav.classList.add('active');
    
    carregarMetricas();
    carregarCategoriasRapidas();
    carregarListaCritica();
  }

  function mostrarTela(telaId) {
    const telas = ['mainScreen', 'loginScreen', 'itemsScreen', 'withdrawScreen', 'searchScreen', 'recentesScreen', 'criticosScreen'];
    telas.forEach(tela => {
      const el = document.getElementById(tela);
      if (el) el.classList.remove('active');
    });
    const telaAtiva = document.getElementById(telaId);
    if (telaAtiva) telaAtiva.classList.add('active');
  }

  function voltarDaRetirada() {
    if (telaAnterior && telaAnterior !== 'withdrawScreen') {
      mostrarTela(telaAnterior);
      if (telaAnterior === 'searchScreen') {
        const termo = document.getElementById('globalSearchInput')?.value;
        if (termo && termo.length >= 2) {
          const event = new Event('input');
          document.getElementById('globalSearchInput').dispatchEvent(event);
        }
      }
    } else {
      mostrarTela('mainScreen');
    }
  }

  // ============================================
  // LOGIN
  // ============================================
  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      const senha = document.getElementById('senhaEquipe').value;
      const pin = document.getElementById('pinTecnico').value;
      const errorDiv = document.getElementById('loginError');
      
      if (senha !== 'Estoque@2026') {
        if (errorDiv) errorDiv.textContent = 'Senha inválida';
        return;
      }
      
      const resultado = await apiGetTecnicos();
      
      if (resultado.success) {
        const tecnico = resultado.data.find(t => t.pin === pin);
        if (tecnico) {
          tecnicoAtual = tecnico.nome;
          const nomeSpan = document.getElementById('tecnicoNome');
          if (nomeSpan) nomeSpan.textContent = tecnicoAtual;
          await carregarEstoque();
          mostrarTelaPrincipal();
        } else {
          if (errorDiv) errorDiv.textContent = 'PIN inválido';
        }
      } else {
        if (errorDiv) errorDiv.textContent = 'Erro de conexão';
      }
    });
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      tecnicoAtual = null;
      mostrarTela('loginScreen');
    });
  }

  // ============================================
  // FLUXO RÁPIDO (funções que dependem do DOM)
  // ============================================
  function abrirCategoria(categoria) {
    categoriaAtual = categoria;
    renderizarItensPorCategoria(categoria);
    mostrarTela('itemsScreen');
  }

  function renderizarItensPorCategoria(categoria) {
    const categoryTitle = document.getElementById('categoryTitle');
    if (categoryTitle) categoryTitle.textContent = categoria;
    
    const itens = dadosEstoque.filter(item => item[0] === categoria);
    const container = document.getElementById('itemsContainer');
    if (!container) return;
    
    container.innerHTML = itens.map(item => {
      const atual = Number(item[3]) || 0;
      const minimo = Number(item[4]) || 0;
      const status = atual <= minimo ? 'Crítico' : 'Normal';
      
      return `
        <div class="item-card" onclick="abrirRetirada('${item[1].replace(/'/g, "\\'")}')">
          <div>
            <div class="item-name">${item[1]}</div>
            <div class="item-stock-mini">Estoque: ${atual} / ${minimo} ${item[2]} • ${status}</div>
          </div>
          <div>→</div>
        </div>
      `;
    }).join('');
  }

  function verTodosCriticos() {
    const criticos = dadosEstoque.filter(item => {
      const atual = Number(item[3]) || 0;
      const minimo = Number(item[4]) || 0;
      return atual <= minimo;
    });
    
    const container = document.getElementById('criticosList');
    if (!container) return;
    
    container.innerHTML = criticos.map(item => `
      <div class="critico-item" onclick="abrirRetirada('${item[1].replace(/'/g, "\\'")}')">
        <div>
          <strong>${item[1]}</strong>
          <div style="font-size:12px;color:#718096;">Estoque: ${item[3]} / Mínimo: ${item[4]} ${item[2]}</div>
        </div>
        <div>→</div>
      </div>
    `).join('');
    
    mostrarTela('criticosScreen');
  }

  // ============================================
  // RETIRADA
  // ============================================
  function abrirRetirada(nomeItem) {
    // Guarda a tela ativa antes de abrir a retirada
    const telas = ['mainScreen', 'itemsScreen', 'searchScreen', 'recentesScreen', 'criticosScreen'];
    for (let tela of telas) {
      const el = document.getElementById(tela);
      if (el && el.classList.contains('active')) {
        telaAnterior = tela;
        break;
      }
    }
    
    itemAtual = dadosEstoque.find(item => item[1] === nomeItem);
    if (!itemAtual) return;
    
    const withdrawItemName = document.getElementById('withdrawItemName');
    const withdrawItemStock = document.getElementById('withdrawItemStock');
    
    if (withdrawItemName) withdrawItemName.textContent = itemAtual[1];
    if (withdrawItemStock) withdrawItemStock.innerHTML = `Estoque atual: ${itemAtual[3]} ${itemAtual[2]} | Mínimo: ${itemAtual[4]} ${itemAtual[2]}`;
    
    const qtdeValor = document.getElementById('qtdeValor');
    if (qtdeValor) qtdeValor.textContent = '1';
    
    const observacao = document.getElementById('observacao');
    if (observacao) observacao.value = '';
    
    const withdrawError = document.getElementById('withdrawError');
    if (withdrawError) withdrawError.textContent = '';
    
    const categoriasComPatrimonio = ['Rádios', 'Antenas', 'Rede e Monitoramento', 'Energia'];
    const precisaPatrimonio = categoriasComPatrimonio.includes(itemAtual[0]) && itemAtual[2] === 'un';
    const containerPatri = document.getElementById('patrimoniosContainer');
    
    if (containerPatri) {
      containerPatri.style.display = precisaPatrimonio ? 'block' : 'none';
      if (precisaPatrimonio) renderizarPatrimonios();
    }
    
    mostrarTela('withdrawScreen');
  }

  function renderizarPatrimonios() {
    const qtdeValor = document.getElementById('qtdeValor');
    const qtde = qtdeValor ? parseInt(qtdeValor.textContent) : 1;
    const container = document.getElementById('patrimoniosList');
    const addBtn = document.getElementById('addPatrimonio');
    
    if (!container) return;
    
    if (addBtn) {
      addBtn.style.display = 'none';
    }
    
    let html = '';
    for (let i = 0; i < qtde; i++) {
      html += `
        <div class="patrimonio-input">
          <input type="text" placeholder="Patrimônio ${i+1}" required>
          <button class="remove-patrimonio" onclick="this.parentElement.remove()">✖</button>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  // Controles de quantidade
  const qtdeMenos = document.getElementById('qtdeMenos');
  if (qtdeMenos) {
    qtdeMenos.addEventListener('click', () => {
      const qtdeValor = document.getElementById('qtdeValor');
      let val = qtdeValor ? parseInt(qtdeValor.textContent) : 1;
      if (val > 1) {
        if (qtdeValor) qtdeValor.textContent = val - 1;
        if (document.getElementById('patrimoniosContainer').style.display === 'block') renderizarPatrimonios();
      }
    });
  }

  const qtdeMais = document.getElementById('qtdeMais');
  if (qtdeMais) {
    qtdeMais.addEventListener('click', () => {
      const qtdeValor = document.getElementById('qtdeValor');
      let val = qtdeValor ? parseInt(qtdeValor.textContent) : 1;
      const maxEstoque = Number(itemAtual?.[3]) || 0;
      if (val < maxEstoque) {
        if (qtdeValor) qtdeValor.textContent = val + 1;
        if (document.getElementById('patrimoniosContainer').style.display === 'block') renderizarPatrimonios();
      } else {
        const withdrawError = document.getElementById('withdrawError');
        if (withdrawError) withdrawError.textContent = `Máximo disponível: ${maxEstoque}`;
        setTimeout(() => {
          if (withdrawError) withdrawError.textContent = '';
        }, 3000);
      }
    });
  }

  const btnConfirmar = document.getElementById('btnConfirmar');
  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', async () => {
      const qtdeValor = document.getElementById('qtdeValor');
      const quantidade = qtdeValor ? parseInt(qtdeValor.textContent) : 1;
      const observacao = document.getElementById('observacao');
      const obsValue = observacao ? observacao.value : '';
      
      const patrimonios = [];
      document.querySelectorAll('#patrimoniosList input').forEach(input => {
        if (input.value.trim()) patrimonios.push(input.value.trim());
      });
      
      const precisaPatrimonio = document.getElementById('patrimoniosContainer').style.display === 'block';
      const withdrawError = document.getElementById('withdrawError');
      
      if (precisaPatrimonio && patrimonios.length !== quantidade) {
        if (withdrawError) withdrawError.textContent = `Informe exatamente ${quantidade} patrimônio(s)`;
        return;
      }
      
      if (precisaPatrimonio) {
        const algumVazio = patrimonios.some(p => p === '');
        if (algumVazio) {
          if (withdrawError) withdrawError.textContent = `Preencha todos os patrimônios`;
          return;
        }
      }
      
      const btn = document.getElementById('btnConfirmar');
      if (btn) {
        btn.textContent = 'Processando...';
        btn.disabled = true;
      }
      
      const resultado = await apiRegistrarRetirada({
        action: 'registrarRetirada',
        itemNome: itemAtual[1],
        quantidade: quantidade,
        tecnico: tecnicoAtual,
        observacao: obsValue,
        patrimonios: patrimonios
      });
      
      if (resultado.success) {
        retiradasRecentes.unshift({ 
          item: itemAtual[1], 
          quantidade: quantidade, 
          data: new Date().toLocaleString(), 
          tecnico: tecnicoAtual 
        });
        if (retiradasRecentes.length > 20) retiradasRecentes.pop();
        localStorage.setItem('retiradasRecentes', JSON.stringify(retiradasRecentes));
        alert(`✅ Retirada registrada!\nItem: ${itemAtual[1]}\nQuantidade: ${quantidade}`);
        await carregarEstoque(true); // força refresh após retirada
        mostrarTelaPrincipal();
      } else {
        if (withdrawError) withdrawError.textContent = resultado.error;
      }
      
      if (btn) {
        btn.textContent = 'Confirmar retirada';
        btn.disabled = false;
      }
    });
  }

  // ============================================
  // BUSCA
  // ============================================
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const termo = e.target.value.toLowerCase();
      if (termo.length < 2) {
        carregarCategoriasRapidas();
        return;
      }
      
      const resultados = dadosEstoque.filter(item => 
        item[1].toLowerCase().includes(termo)
      );
      
      const container = document.getElementById('quickCategories');
      if (!container) return;
      
      if (resultados.length === 0) {
        container.innerHTML = '<div class="quick-card" style="grid-column:span 4">Nenhum item encontrado</div>';
      } else {
        container.innerHTML = resultados.map(item => `
          <div class="quick-card" onclick="abrirRetirada('${item[1].replace(/'/g, "\\'")}')">
            <div class="quick-label">${item[1].substring(0, 20)}</div>
          </div>
        `).join('');
      }
    });
  }

  const globalSearchInput = document.getElementById('globalSearchInput');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      const termo = e.target.value.toLowerCase();
      const searchResults = document.getElementById('searchResults');
      if (!searchResults) return;
      
      if (termo.length < 2) {
        searchResults.innerHTML = '';
        return;
      }
      
      const resultados = dadosEstoque.filter(item => 
        item[1].toLowerCase().includes(termo)
      );
      
      if (resultados.length === 0) {
        searchResults.innerHTML = '<div style="text-align:center;padding:40px;color:#718096;">Nenhum item encontrado</div>';
      } else {
        searchResults.innerHTML = resultados.map(item => `
          <div class="search-result-item" onclick="abrirRetirada('${item[1].replace(/'/g, "\\'")}')">
            <div>
              <strong>${item[1]}</strong>
              <div style="font-size:12px;color:#718096;">Estoque: ${item[3]} ${item[2]}</div>
            </div>
            <div>→</div>
          </div>
        `).join('');
      }
    });
  }

  // ============================================
  // RECENTES
  // ============================================
  function carregarRecentes() {
    const container = document.getElementById('recentesList');
    if (!container) return;
    
    if (retiradasRecentes.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#718096;">Nenhuma retirada recente</div>';
      return;
    }
    
    container.innerHTML = retiradasRecentes.map(r => `
      <div class="recente-item">
        <div>
          <strong>${r.item}</strong>
          <div style="font-size:12px;color:#718096;">${r.quantidade} un • ${r.tecnico}</div>
        </div>
        <div style="font-size:12px;color:#718096;">${r.data}</div>
      </div>
    `).join('');
  }

  // ============================================
  // NAVEGAÇÃO INFERIOR
  // ============================================
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', () => {
      const tela = nav.dataset.nav;
      if (tela === 'home') {
        mostrarTelaPrincipal();
      } else if (tela === 'search') {
        mostrarTela('searchScreen');
      } else if (tela === 'recentes') {
        carregarRecentes();
        mostrarTela('recentesScreen');
      } else if (tela === 'criticos') {
        verTodosCriticos();
      }
    });
  });

  const syncNowBtn = document.getElementById('syncNowBtn');
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', async () => {
      await carregarEstoque(true); // força refresh
    });
  }

  // ============================================
  // AJUSTE DO BOTÃO VOLTAR NA TELA DE RETIRADA
  // ============================================
  function ajustarBotaoVoltar() {
    const backBtn = document.querySelector('#withdrawScreen .back-btn');
    if (backBtn) {
      backBtn.setAttribute('onclick', 'voltarDaRetirada()');
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ajustarBotaoVoltar);
  } else {
    ajustarBotaoVoltar();
  }

  console.log('App carregado - versão API com cache e navegação corrigida');