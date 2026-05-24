import type { Reserva } from '../types.js'
import { storeReservas, storeArquivos } from '../__store__/index.js'
import { randomUUID } from '../__store__/uuid.js'

interface BloqueadaOpts {
  expiradaHa?: number   // horas no passado (0 = expirou agora, >0 = já expirada)
  quadra_id?: number
  data?: string
  horario_inicio?: string
}

const CPF_TEST = '529.982.247-25'
const DATA_TEST = '2025-05-21'

/**
 * Cria uma reserva no status 'bloqueada'.
 * Se expiradaHa > 0, a janela_expiracao_at fica no passado (já expirada).
 * Se expiradaHa === 0, expira exatamente now() (borda).
 */
export async function criarReservaBloqueada(opts: BloqueadaOpts = {}): Promise<Reserva> {
  const { expiradaHa, quadra_id = 1, data = DATA_TEST, horario_inicio = '09:00' } = opts

  const agora = new Date()
  let janela_expiracao_at: string

  if (expiradaHa !== undefined) {
    // Coloca a expiração no passado
    janela_expiracao_at = new Date(agora.getTime() - expiradaHa * 60 * 60 * 1000).toISOString()
  } else {
    // Janela normal de 2h no futuro
    janela_expiracao_at = new Date(agora.getTime() + 2 * 60 * 60 * 1000).toISOString()
  }

  const reserva: Reserva = {
    id: randomUUID(),
    quadra_id,
    cpf_cliente: CPF_TEST,
    data,
    horario_inicio,
    horario_fim: '10:00',
    status: 'bloqueada',
    comprovante_url: null,
    janela_expiracao_at,
    criado_at: agora.toISOString(),
    confirmado_at: null,
  }

  storeReservas.save(reserva)
  return reserva
}

/**
 * Cria uma reserva já confirmada (com comprovante anexado).
 */
export async function criarReservaConfirmada(opts: BloqueadaOpts = {}): Promise<Reserva> {
  const base = await criarReservaBloqueada({ ...opts, quadra_id: opts.quadra_id ?? 3 })
  const agora = new Date().toISOString()
  const comprovante_url = storeArquivos.save(base.id, 'comprovante.jpg')
  const confirmada = storeReservas.update(base.id, {
    status: 'confirmada',
    comprovante_url,
    confirmado_at: agora,
  })!
  return confirmada
}

/**
 * Cria uma reserva já marcada como expirada.
 */
export async function criarReservaExpirada(opts: BloqueadaOpts = {}): Promise<Reserva> {
  const base = await criarReservaBloqueada({ ...opts, expiradaHa: 3, quadra_id: opts.quadra_id ?? 2 })
  const expirada = storeReservas.update(base.id, { status: 'expirada' })!
  return expirada
}

/** Limpa todas as reservas do store (usar em beforeEach). */
export async function limparReservas(): Promise<void> {
  storeReservas.clear()
}
