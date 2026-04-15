import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { loginWithPin, verifyToken } from './services/auth.service.js';
import {
  getInventoryList,
  getTechnicians,
  getCriticalItems,
  getLogEntries,
  updateInventoryQuantity,
  appendLogEntry
} from './services/sheets.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 3000;
const frontendPath = path.resolve(__dirname, '../frontend');

if (process.env.PORT && Number(process.env.PORT) !== PORT) {
  console.warn(`PORT=${process.env.PORT} ignorada. O servidor local inicia fixo na porta ${PORT}.`);
}

const CATEGORIAS_COM_PATRIMONIO = ['Rádios', 'Antenas', 'Rede e Monitoramento', 'Energia'];

function needsPatrimony(categoria: string, unidade: string) {
  return CATEGORIAS_COM_PATRIMONIO.includes(categoria) && unidade === 'un';
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = verifyToken(req.headers.authorization?.toString());
  if (!token) {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado.' });
    return;
  }
  next();
}

async function handleLogin(req: Request, res: Response) {
  const senha = String(req.body?.senha || '').trim();
  const pin = String(req.body?.pin || '').trim();

  if (!senha || !pin) {
    res.status(400).json({ success: false, error: 'Senha e PIN são obrigatórios.' });
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    res.status(400).json({ success: false, error: 'PIN inválido. Informe exatamente 4 dígitos.' });
    return;
  }

  const result = await loginWithPin(senha, pin);
  if (!result.success) {
    res.status(401).json(result);
    return;
  }

  res.status(200).json(result);
}

app.use(express.json());
app.use(express.static(frontendPath));

app.get('/api', (_req, res) => {
  res.status(200).json({ success: true, message: 'API local do Estoque Pro está online' });
});

app.post('/api/auth/login', handleLogin);
app.post('/api/auth', handleLogin);

app.get('/api/tecnicos', async (_req, res) => {
  try {
    const tecnicos = await getTechnicians();
    res.status(200).json({ success: true, data: tecnicos });
  } catch (error) {
    console.error('Erro em /api/tecnicos:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler técnicos.' });
  }
});

app.get('/api/estoque', requireAuth, async (_req, res) => {
  try {
    const items = await getInventoryList();
    res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    console.error('Erro em /api/estoque:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler estoque.' });
  }
});

app.get('/api/criticos', requireAuth, async (_req, res) => {
  try {
    const criticos = await getCriticalItems();
    res.status(200).json({ success: true, data: { criticos } });
  } catch (error) {
    console.error('Erro em /api/criticos:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler itens críticos.' });
  }
});

app.get('/api/logs', requireAuth, async (_req, res) => {
  try {
    const logs = await getLogEntries();
    res.status(200).json({ success: true, data: { logs } });
  } catch (error) {
    console.error('Erro em /api/logs:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler logs.' });
  }
});

app.post('/api/retirada', requireAuth, async (req, res) => {
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

    const requiresPatrimony = needsPatrimony(item.categoria, item.unidade);
    const patrimoniosArray = Array.isArray(patrimonios) ? patrimonios.map(String).map(p => p.trim()).filter(Boolean) : [];

    if (requiresPatrimony && patrimoniosArray.length !== quantidadeNumber) {
      res.status(400).json({
        success: false,
        error: `Informe exatamente ${quantidadeNumber} patrimônio(s).`
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

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor local rodando em http://localhost:${PORT}`);
  console.log(`Frontend disponível em http://localhost:${PORT}`);
  console.log(`API disponível em http://localhost:${PORT}/api`);
});
