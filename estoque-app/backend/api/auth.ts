import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loginWithPin } from '../services/auth.service.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

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
}
