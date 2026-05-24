import { describe, it, expect } from 'vitest'
import { consultarDisponibilidade } from '@/domain/agenda/workflows'

describe('ConsultarDisponibilidade', () => {

  // ── Caminho feliz ──────────────────────────────────────────────────────────

  it('retorna slots das 08h–11h e 14h–22h para dia de semana válido', async () => {
    const result = await consultarDisponibilidade({ data: '2025-05-21' }) // quarta
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const disponiveis = result.data.slots.filter(s => s.status === 'disponivel').map(s => s.horario)
    expect(disponiveis).toContain('08:00')
    expect(disponiveis).toContain('10:00')
    expect(disponiveis).toContain('14:00')
    expect(disponiveis).toContain('21:00')
    // horários fora de operação aparecem como fora_operacao, não disponivel
    expect(disponiveis).not.toContain('12:00')
    expect(disponiveis).not.toContain('13:00')
    expect(disponiveis).not.toContain('22:00')
  })

  it('retorna slots das 07h–12h para sábado', async () => {
    const result = await consultarDisponibilidade({ data: '2025-05-24' }) // sábado
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const disponiveis = result.data.slots.filter(s => s.status === 'disponivel').map(s => s.horario)
    expect(disponiveis).toContain('07:00')
    expect(disponiveis).toContain('11:00')
    // após 12h sábado e tarde são fora_operacao
    expect(disponiveis).not.toContain('12:00')
    expect(disponiveis).not.toContain('14:00')
  })

  it('retorna status correto para cada quadra independentemente', async () => {
    const result = await consultarDisponibilidade({ data: '2025-05-21', quadra_id: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    result.data.slots.forEach(slot => {
      expect(slot.quadra_id).toBe(1)
      expect(['disponivel', 'bloqueado', 'confirmado', 'fora_operacao']).toContain(slot.status)
    })
  })

  // ── Falhas de domínio ──────────────────────────────────────────────────────

  it('HORARIO_FORA_DE_OPERACAO — domingo retorna todos os slots como fora_operacao', async () => {
    const result = await consultarDisponibilidade({ data: '2025-05-18' }) // domingo
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const disponiveis = result.data.slots.filter(s => s.status === 'disponivel')
    expect(disponiveis).toHaveLength(0)
  })

  it('HORARIO_FORA_DE_OPERACAO — sábado após 12h aparece como fora_operacao', async () => {
    const result = await consultarDisponibilidade({ data: '2025-05-24' }) // sábado
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const slot12 = result.data.slots.find(s => s.horario === '12:00')
    expect(slot12?.status).toBe('fora_operacao')
  })

  it('HORARIO_FORA_DE_OPERACAO — intervalo de almoço (12h–14h) aparece como fora_operacao em dia de semana', async () => {
    const result = await consultarDisponibilidade({ data: '2025-05-21' }) // quarta
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const slot12 = result.data.slots.find(s => s.horario === '12:00')
    const slot13 = result.data.slots.find(s => s.horario === '13:00')
    expect(slot12?.status).toBe('fora_operacao')
    expect(slot13?.status).toBe('fora_operacao')
  })

  // ── Concorrência ──────────────────────────────────────────────────────────

  it('concorrência — dois clientes consultam simultaneamente recebem estado consistente', async () => {
    const [r1, r2] = await Promise.all([
      consultarDisponibilidade({ data: '2025-05-21' }),
      consultarDisponibilidade({ data: '2025-05-21' }),
    ])
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    // ambas as respostas devem ser idênticas
    expect(r1.data.slots).toEqual(r2.data.slots)
  })

})
