import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getInventoryList } from '../services/sheets.service.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const items = await getInventoryList();
    res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message || 'Erro ao ler estoque.' });
  }
}
