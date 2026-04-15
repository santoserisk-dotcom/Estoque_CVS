import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loginWithPin } from '../services/auth.service.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

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
