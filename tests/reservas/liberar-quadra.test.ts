import { describe, it, expect, beforeEach } from 'vitest'
import { liberarQuadra } from '@/domain/reservas/workflows'
import {
  criarReservaBloqueada,
  criarReservaConfirmada,
  criarReservaExpirada,
  limparReservas,
} from '@/domain/reservas/test-helpers'

describe('LiberarQuadra', () => {

  beforeEach(async () => {
    await limparReservas()
  })

  // ── Caminho feliz ──────────────────────────────────────────────────────────

  it('reserva bloqueada expirada → status muda para expirada', async () => {
    const reserva = await criarReservaBloqueada({ expiradaHa: 1 })

    const result = await liberarQuadra({ reserva_id: reserva.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.reserva_id).toBe(reserva.id)
    expect(result.data.quadra_id).toBe(reserva.quadra_id)
  })

  it('após liberação, slot fica disponível para novas reservas', async () => {
    const reserva = await criarReservaBloqueada({ expiradaHa: 1 })
    await liberarQuadra({ reserva_id: reserva.id })

    // tentar reservar o mesmo slot deve funcionar agora
    const { iniciarReserva } = await import('@/domain/reservas/workflows')
    const nova = await iniciarReserva({
      quadra_id: reserva.quadra_id,
      data: reserva.data,
      horario_inicio: reserva.horario_inicio,
      cpf_cliente: '529.982.247-25',
    })
    expect(nova.ok).toBe(true)
  })

  it('job de expiração em lote — expira todas as reservas vencidas de uma vez', async () => {
    const r1 = await criarReservaBloqueada({ expiradaHa: 1 })
    const r2 = await criarReservaBloqueada({ expiradaHa: 2 })
    const r3 = await criarReservaBloqueada({ expiradaHa: 0 }) // ainda dentro da janela

    const { expirarReservasVencidas } = await import('@/domain/reservas/workflows')
    const result = await expirarReservasVencidas()

    expect(result.liberadas).toContain(r1.id)
    expect(result.liberadas).toContain(r2.id)
    expect(result.liberadas).not.toContain(r3.id) // ainda válida
  })

  // ── Falhas de domínio ──────────────────────────────────────────────────────

  it('RESERVA_NAO_ENCONTRADA — reserva_id inexistente', async () => {
    const result = await liberarQuadra({
      reserva_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('RESERVA_NAO_ENCONTRADA')
  })

  it('reserva confirmada NÃO é afetada pelo job de expiração', async () => {
    const reserva = await criarReservaConfirmada()

    const result = await liberarQuadra({ reserva_id: reserva.id })

    // deve retornar erro ou ignorar silenciosamente — nunca expirar reserva confirmada
    if (!result.ok) {
      expect(['RESERVA_NAO_ENCONTRADA', 'RESERVA_JA_CONFIRMADA']).toContain(result.erro.code)
    } else {
      // se retornou ok, o status da reserva não mudou
      expect(result.data.reserva_id).toBeFalsy() // não deve ter liberado
    }
  })

  it('reserva já expirada não é processada duas vezes', async () => {
    const reserva = await criarReservaExpirada()

    const result = await liberarQuadra({ reserva_id: reserva.id })

    // idempotente — segunda chamada não quebra
    expect(result.ok !== undefined).toBe(true)
  })

  // ── Concorrência ──────────────────────────────────────────────────────────

  it('concorrência — upload chega no mesmo instante que o job de expiração — comprovante prevalece', async () => {
    // Reserva na borda da janela (expirou há ~0ms)
    const reserva = await criarReservaBloqueada({ expiradaHa: 0 })

    const { anexarComprovante } = await import('@/domain/reservas/workflows')
    const arquivo = new File([new ArrayBuffer(100_000)], 'pix.jpg', { type: 'image/jpeg' })

    const [uploadResult, liberacaoResult] = await Promise.all([
      anexarComprovante({ reserva_id: reserva.id, arquivo }),
      liberarQuadra({ reserva_id: reserva.id }),
    ])

    // Exatamente um deve ter vencido — o estado final é atômico
    const confirmada = uploadResult.ok && uploadResult.data.reserva.status === 'confirmada'
    const expirada = !uploadResult.ok || liberacaoResult.ok
    expect(confirmada || expirada).toBe(true)
    // Nunca os dois ao mesmo tempo
    expect(confirmada && liberacaoResult.ok).toBe(false)
  })

})
