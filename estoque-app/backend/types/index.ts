export interface InventoryItem {
  categoria: string;
  nome: string;
  unidade: string;
  quantidadeAtual: number;
  minimo: number;
  rowIndex: number;
}

export interface Technician {
  pin: string;
  nome: string;
  ativo: boolean;
}

export interface LogEntry {
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
}

export interface RetiradaPayload {
  itemNome: string;
  quantidade: number;
  tecnico: string;
  observacao?: string;
  patrimonios?: string[];
}

export interface AuthPayload {
  pin: string;
  nome: string;
}
