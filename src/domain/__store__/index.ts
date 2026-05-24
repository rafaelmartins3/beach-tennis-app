/**
 * In-memory store — usado em testes (NODE_ENV=test) e como fallback local.
 * Em produção, os workflows chamam o Supabase diretamente.
 */

import type { Cliente, Reserva } from '../types.js'

interface Store {
  reservas: Map<string, Reserva>
  clientes: Map<string, Cliente>   // key = cpf
  arquivos: Map<string, string>    // key = reserva_id, value = url simulada
}

const store: Store = {
  reservas: new Map(),
  clientes: new Map(),
  arquivos: new Map(),
}

// ─── Reservas ─────────────────────────────────────────────────────────────────

export const storeReservas = {
  all: (): Reserva[] => Array.from(store.reservas.values()),

  findById: (id: string): Reserva | undefined => store.reservas.get(id),

  findAtivo: (quadra_id: number, data: string, horario_inicio: string): Reserva | undefined =>
    Array.from(store.reservas.values()).find(
      r =>
        r.quadra_id === quadra_id &&
        r.data === data &&
        r.horario_inicio === horario_inicio &&
        (r.status === 'bloqueada' || r.status === 'confirmada'),
    ),

  save: (r: Reserva): Reserva => {
    store.reservas.set(r.id, r)
    return r
  },

  update: (id: string, patch: Partial<Reserva>): Reserva | undefined => {
    const r = store.reservas.get(id)
    if (!r) return undefined
    const updated = { ...r, ...patch }
    store.reservas.set(id, updated)
    return updated
  },

  clear: (): void => store.reservas.clear(),

  vencidas: (): Reserva[] =>
    Array.from(store.reservas.values()).filter(
      r => r.status === 'bloqueada' && new Date(r.janela_expiracao_at) < new Date(),
    ),
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export const storeClientes = {
  findByCpf: (cpf: string): Cliente | undefined => store.clientes.get(cpf),

  save: (c: Cliente): Cliente => {
    store.clientes.set(c.cpf, c)
    return c
  },

  clear: (): void => store.clientes.clear(),
}

// ─── Arquivos (simulação de Storage) ─────────────────────────────────────────

export const storeArquivos = {
  save: (reserva_id: string, nome: string): string => {
    const url = `https://storage.test/comprovantes/${reserva_id}/${nome}`
    store.arquivos.set(reserva_id, url)
    return url
  },

  findByReserva: (reserva_id: string): string | undefined =>
    store.arquivos.get(reserva_id),
}
