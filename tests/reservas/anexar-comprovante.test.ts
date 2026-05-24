import { describe, it, expect, beforeEach, vi } from 'vitest'
import { anexarComprovante } from '@/domain/reservas/workflows'
import { criarReservaBloqueada, criarReservaConfirmada, limparReservas } from '@/domain/reservas/test-helpers'

// Helper para criar um File fake
function makeFile(name: string, type: string, sizeBytes: number): File {
  const buffer = new ArrayBuffer(sizeBytes)
  return new File([buffer], name, { type })
}

describe('AnexarComprovante', () => {

  beforeEach(async () => {
    await limparReservas()
  })

  // ── Caminho feliz ──────────────────────────────────────────────────────────

  it('JPG válido dentro da janela — ComprovanteAnexado + ReservaConfirmada', async () => {
    const reserva = await criarReservaBloqueada()
    const arquivo = makeFile('comprovante.jpg', 'image/jpeg', 500_000)

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.reserva.status).toBe('confirmada')
    expect(result.data.comprovante_url).toBeTruthy()
    expect(result.data.comprovante_url).toContain(reserva.id)
  })

  it('PNG válido dentro da janela — ReservaConfirmada', async () => {
    const reserva = await criarReservaBloqueada()
    const arquivo = makeFile('pix.png', 'image/png', 200_000)

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.reserva.status).toBe('confirmada')
  })

  it('PDF válido dentro da janela — ReservaConfirmada', async () => {
    const reserva = await criarReservaBloqueada()
    const arquivo = makeFile('comprovante.pdf', 'application/pdf', 1_000_000)

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.reserva.status).toBe('confirmada')
  })

  it('confirmado_at é preenchido após confirmação', async () => {
    const reserva = await criarReservaBloqueada()
    const arquivo = makeFile('pix.jpg', 'image/jpeg', 100_000)

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.reserva.confirmado_at).not.toBeNull()
  })

  // ── Falhas de domínio ──────────────────────────────────────────────────────

  it('JANELA_EXPIRADA — upload após 2h', async () => {
    const reserva = await criarReservaBloqueada({ expiradaHa: 1 }) // já expirada
    const arquivo = makeFile('pix.jpg', 'image/jpeg', 100_000)

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('JANELA_EXPIRADA')
  })

  it('RESERVA_NAO_ENCONTRADA — reserva_id inexistente', async () => {
    const arquivo = makeFile('pix.jpg', 'image/jpeg', 100_000)

    const result = await anexarComprovante({
      reserva_id: '00000000-0000-0000-0000-000000000000',
      arquivo,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('RESERVA_NAO_ENCONTRADA')
  })

  it('ARQUIVO_INVALIDO — mime_type não suportado (.exe)', async () => {
    const reserva = await criarReservaBloqueada()
    const arquivo = makeFile('virus.exe', 'application/octet-stream', 100_000)

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('ARQUIVO_INVALIDO')
    expect(result.erro.motivo).toBe('formato_nao_suportado')
  })

  it('ARQUIVO_INVALIDO — tamanho excedido (>10MB)', async () => {
    const reserva = await criarReservaBloqueada()
    const arquivo = makeFile('gigante.jpg', 'image/jpeg', 11_000_000) // 11MB

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('ARQUIVO_INVALIDO')
    expect(result.erro.motivo).toBe('tamanho_excedido')
  })

  it('RESERVA_JA_CONFIRMADA — segunda tentativa de upload', async () => {
    const reserva = await criarReservaConfirmada()
    const arquivo = makeFile('pix2.jpg', 'image/jpeg', 100_000)

    const result = await anexarComprovante({ reserva_id: reserva.id, arquivo })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('RESERVA_JA_CONFIRMADA')
  })

  // ── Concorrência ──────────────────────────────────────────────────────────

  it('concorrência — dois uploads simultâneos para a mesma reserva — apenas um confirma', async () => {
    const reserva = await criarReservaBloqueada()
    const arq1 = makeFile('pix1.jpg', 'image/jpeg', 100_000)
    const arq2 = makeFile('pix2.jpg', 'image/jpeg', 100_000)

    const [r1, r2] = await Promise.all([
      anexarComprovante({ reserva_id: reserva.id, arquivo: arq1 }),
      anexarComprovante({ reserva_id: reserva.id, arquivo: arq2 }),
    ])

    const sucessos = [r1, r2].filter(r => r.ok).length
    expect(sucessos).toBe(1)

    const falha = [r1, r2].find(r => !r.ok)
    if (falha && !falha.ok) {
      expect(['RESERVA_JA_CONFIRMADA', 'RESERVA_NAO_ENCONTRADA']).toContain(falha.erro.code)
    }
  })

})
