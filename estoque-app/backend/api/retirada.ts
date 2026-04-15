import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../services/auth.service.ts';
import { getInventoryList, updateInventoryQuantity, appendLogEntry } from '../services/sheets.service.ts';

function needsPatrimony(categoria: string, unidade: string) {
  const categoriasComPatrimonio = ['Rádios', 'Antenas', 'Rede e Monitoramento', 'Energia'];
  return categoriasComPatrimonio.includes(categoria) && unidade === 'un';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

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
      res.status(400).json({ success: false, error: `Estoque insuficiente. Disponível: ${item.quantidadeAtual} ${item.unidade}` });
      return;
    }

    const requiresPatrimony = needsPatrimony(item.categoria, item.unidade);
    const patrimoniosArray = Array.isArray(patrimonios) ? patrimonios.map(String).map(p => p.trim()).filter(Boolean) : [];

    if (requiresPatrimony && patrimoniosArray.length !== quantidadeNumber) {
      res.status(400).json({ success: false, error: `Informe exatamente ${quantidadeNumber} patrimônio(s).` });
      return;
    }

    if (requiresPatrimony && patrimoniosArray.some(p => p.length === 0)) {
      res.status(400).json({ success: false, error: 'Todos os patrimônios devem ser preenchidos.' });
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
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao registrar retirada.' });
  }
}
