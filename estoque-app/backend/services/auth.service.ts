import jwt from 'jsonwebtoken';
import { getTechnicians } from './sheets.service.js';
import type { Technician, AuthPayload } from '../types/index.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-session-secret';
const SESSION_DURATION = '8h';
const TEAM_PASSWORD = 'Estoque@2026';

export interface AuthResult {
  success: boolean;
  token?: string;
  tecnico?: AuthPayload;
  error?: string;
}

export function getBearerToken(authHeader?: string) {
  if (!authHeader) return undefined;
  const [type, token] = authHeader.split(' ');
  return type === 'Bearer' ? token : undefined;
}

export async function loginWithPin(senha: string, pin: string): Promise<AuthResult> {
  if (senha !== TEAM_PASSWORD) {
    return { success: false, error: 'Senha da equipe inválida.' };
  }

  const technicians = await getTechnicians();
  const technician = technicians.find(tech => tech.pin === pin && tech.ativo);

  if (!technician) {
    return { success: false, error: 'PIN inválido ou técnico inativo.' };
  }

  const token = jwt.sign({ pin: technician.pin, nome: technician.nome }, SESSION_SECRET, {
    expiresIn: SESSION_DURATION
  });

  return {
    success: true,
    token,
    tecnico: { pin: technician.pin, nome: technician.nome }
  };
}

export function verifyToken(tokenHeader?: string): AuthPayload | null {
  const token = getBearerToken(tokenHeader);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    if (typeof payload === 'object' && payload && 'pin' in payload && 'nome' in payload) {
      return {
        pin: String((payload as any).pin),
        nome: String((payload as any).nome)
      };
    }
    return null;
  } catch {
    return null;
  }
}
