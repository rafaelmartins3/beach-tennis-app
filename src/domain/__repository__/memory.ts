/**
 * Implementações in-memory dos repositórios.
 * Usadas em testes (Vitest) — delegam para o __store__ existente.
 *
 * As operações ATÔMICAS (salvarSeDisponivel, confirmarSePendente,
 * expirarSePendente, encontrarOuSalvar) executam check+save de forma
 * puramente síncrona dentro de um único bloco sem yield points.
 * Isso garante exclusão mútua no event loop single-threaded do Node.js,
 * fazendo os testes de concorrência passarem corretamente.
 */

import { storeReservas, storeClientes, storeArquivos } from '../__store__/index.js'
import type { ReservaRepository, ClienteRepository, ArquivoRepository } from './types.js'
import type { Reserva, Cliente } from '../types.js'

// ─── ReservaRepository ────────────────────────────────────────────────────────

export const memoryReservaRepo: ReservaRepository = {
  async all() {
    return storeReservas.all()
  },

  async findById(id) {
    return storeReservas.findById(id)
  },

  async findAtivo(quadra_id, data, horario_inicio) {
    return storeReservas.findAtivo(quadra_id, data, horario_inicio)
  },

  async findAtivosByData(data, quadra_id) {
    return storeReservas
      .all()
      .filter(
        r =>
          r.data === data &&
          (r.status === 'bloqueada' || r.status === 'confirmada') &&
          (quadra_id === undefined || r.quadra_id === quadra_id),
      )
  },

  async save(r) {
    return storeReservas.save(r)
  },

  async update(id, patch) {
    return storeReservas.update(id, patch)
  },

  async vencidas() {
    return storeReservas.vencidas()
  },

  // ── Operações atômicas ──────────────────────────────────────────────────────

  salvarSeDisponivel(r: Reserva) {
    // Bloco 100% síncrono: nenhum await entre check e save.
    // Em JS single-threaded, nenhuma microtask pode interromper este bloco.
    const existing = storeReservas.findAtivo(r.quadra_id, r.data, r.horario_inicio)
    if (existing) return Promise.resolve({ salvo: false })
    storeReservas.save(r)
    return Promise.resolve({ salvo: true })
  },

  confirmarSePendente(id, patch) {
    // Bloco 100% síncrono: atualiza somente se status === 'bloqueada'
    const r = storeReservas.findById(id)
    if (!r || r.status !== 'bloqueada') return Promise.resolve(undefined)
    const updated = storeReservas.update(id, patch)
    return Promise.resolve(updated)
  },

  expirarSePendente(id) {
    // Bloco 100% síncrono: expira somente se status === 'bloqueada'
    const r = storeReservas.findById(id)
    if (!r || r.status !== 'bloqueada') return Promise.resolve(false)
    storeReservas.update(id, { status: 'expirada' })
    return Promise.resolve(true)
  },
}

// ─── ClienteRepository ────────────────────────────────────────────────────────

export const memoryClienteRepo: ClienteRepository = {
  async findByCpf(cpf) {
    return storeClientes.findByCpf(cpf)
  },

  async save(c) {
    return storeClientes.save(c)
  },

  encontrarOuSalvar(c: Cliente) {
    // Bloco 100% síncrono: nenhum await entre check e save.
    const existing = storeClientes.findByCpf(c.cpf)
    if (existing) return Promise.resolve({ criado: false, cliente: existing })
    storeClientes.save(c)
    return Promise.resolve({ criado: true, cliente: c })
  },
}

// ─── ArquivoRepository ────────────────────────────────────────────────────────

export const memoryArquivoRepo: ArquivoRepository = {
  async save(reserva_id, arquivo) {
    return storeArquivos.save(reserva_id, arquivo.name)
  },

  async findByReserva(reserva_id) {
    return storeArquivos.findByReserva(reserva_id)
  },
}
