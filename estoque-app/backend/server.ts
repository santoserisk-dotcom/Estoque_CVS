import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar dotenv ANTES de qualquer outro import que use variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env da pasta backend
dotenv.config({ path: path.join(__dirname, '.env') });

// Importar serviços depois do dotenv.config()
import { loginWithPin, verifyToken } from './services/auth.service.js';
import {
  getInventoryList,
  getTechnicians,
  getCriticalItems,
  getLogEntries,
  updateInventoryQuantity,
  appendLogEntry
} from './services/sheets.service.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendPath = path.resolve(__dirname, '../frontend');

app.use(express.json());
app.use(express.static(frontendPath));

// Health check
app.get('/api', (_req, res) => {
  res.status(200).json({ success: true, message: 'API local do Estoque Pro está online' });
});

// Listar todos os itens do estoque
app.get('/api/estoque', async (req, res) => {
  try {
    const token = verifyToken(req.headers.authorization?.toString());
    if (!token) {
      res.status(401).json({ success: false, error: 'Token inválido ou expirado.' });
      return;
    }

    const items = await getInventoryList();
    res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    console.error('Erro em /api/estoque:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler estoque.' });
  }
});

// Listar técnicos (não requer autenticação para login)
app.get('/api/tecnicos', async (_req, res) => {
  try {
    const tecnicos = await getTechnicians();
    res.status(200).json({ success: true, data: tecnicos });
  } catch (error) {
    console.error('Erro em /api/tecnicos:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler técnicos.' });
  }
});

// Listar itens críticos
app.get('/api/criticos', async (req, res) => {
  try {
    const token = verifyToken(req.headers.authorization?.toString());
    if (!token) {
      res.status(401).json({ success: false, error: 'Token inválido ou expirado.' });
      return;
    }

    const criticos = await getCriticalItems();
    res.status(200).json({ success: true, data: criticos });
  } catch (error) {
    console.error('Erro em /api/criticos:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler itens críticos.' });
  }
});

// Listar logs
app.get('/api/logs', async (req, res) => {
  try {
    const token = verifyToken(req.headers.authorization?.toString());
    if (!token) {
      res.status(401).json({ success: false, error: 'Token inválido ou expirado.' });
      return;
    }

    const logs = await getLogEntries();
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Erro em /api/logs:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler logs.' });
  }
});

// Login (POST /api/auth/login)
app.post('/api/auth/login', async (req, res) => {
  const { senha, pin } = req.body || {};
  
  if (!senha || !pin) {
    res.status(400).json({ success: false, error: 'Senha e PIN são obrigatórios.' });
    return;
  }

  const result = await loginWithPin(String(senha), String(pin));
  if (!result.success) {
    res.status(401).json(result);
    return;
  }

  res.status(200).json(result);
});

// Endpoint alternativo para compatibilidade
app.post('/api/auth', async (req, res) => {
  const { senha, pin } = req.body || {};
  
  if (!senha || !pin) {
    res.status(400).json({ success: false, error: 'Senha e PIN são obrigatórios.' });
    return;
  }

  const result = await loginWithPin(String(senha), String(pin));
  if (!result.success) {
    res.status(401).json(result);
    return;
  }

  res.status(200).json(result);
});

// Registrar retirada
app.post('/api/retirada', async (req, res) => {
  const token = verifyToken(req.headers.authorization?.toString());
  if (!token) {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado.' });
    return;
  }

  const { itemNome, quantidade, tecnico, observacao, patrimonios } = req.body || {};

  if (!itemNome || !quantidade || !tecnico) {
    res.status(400).json({ success: false, error: 'Item, quantidade e técnico são obrigatórios.' });
    return;
  }

  const quantidadeNumber = Number(quantidade);
  if (!Number.isInteger(quantidadeNumber) || quantidadeNumber <= 0) {
    res.status(400).json({ success: false, error: 'Quantidade inválida.' });
    return;
  }

  try {
    const items = await getInventoryList();
    const item = items.find(i => i.nome === String(itemNome));

    if (!item) {
      res.status(404).json({ success: false, error: 'Item não encontrado.' });
      return;
    }

    if (quantidadeNumber > item.quantidadeAtual) {
      res.status(400).json({ 
        success: false, 
        error: `Estoque insuficiente. Disponível: ${item.quantidadeAtual} ${item.unidade}` 
      });
      return;
    }

    const needsPatrimonio = ['Rádios', 'Antenas', 'Rede e Monitoramento', 'Energia'].includes(item.categoria) && item.unidade === 'un';
    const patrimoniosArray = Array.isArray(patrimonios) ? patrimonios.map(String).map(p => p.trim()).filter(Boolean) : [];

    if (needsPatrimonio && patrimoniosArray.length !== quantidadeNumber) {
      res.status(400).json({ 
        success: false, 
        error: `Informe exatamente ${quantidadeNumber} patrimônio(s).` 
      });
      return;
    }

    if (needsPatrimonio && patrimoniosArray.some(p => p.length === 0)) {
      res.status(400).json({ 
        success: false, 
        error: 'Todos os patrimônios devem ser preenchidos.' 
      });
      return;
    }

    const novoEstoque = item.quantidadeAtual - quantidadeNumber;
    
    await updateInventoryQuantity(item.rowIndex, novoEstoque);
    await appendLogEntry({
      itemNome: item.nome,
      quantidade: quantidadeNumber,
      tecnico: String(tecnico),
      observacao: String(observacao || ''),
      patrimonios: patrimoniosArray,
      categoria: item.categoria,
      unidade: item.unidade,
      estoqueAnterior: item.quantidadeAtual,
      estoqueNovo: novoEstoque
    });

    res.status(200).json({
      success: true,
      data: {
        item: item.nome,
        quantidade: quantidadeNumber,
        estoqueAnterior: item.quantidadeAtual,
        estoqueNovo: novoEstoque
      }
    });
  } catch (error) {
    console.error('Erro em /api/retirada:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Erro ao registrar retirada.' 
    });
  }
});

// Serve o frontend para qualquer outra rota
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor local rodando em http://localhost:${port}`);
  console.log(`Frontend disponível em http://localhost:${port}`);
  console.log(`API disponível em http://localhost:${port}/api`);
});