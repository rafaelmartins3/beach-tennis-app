import type {
  ConsultarDisponibilidadeInput,
  DisponibilidadeConsultada,
  Resultado,
  SlotDisponibilidade,
} from '../types.js'
import { ok } from '../types.js'
import { reservaRepo } from '../__repository__/index.js'
import { QUADRAS, slotsOperacao, todosSlots } from './operacao.js'

/**
 * ConsultarDisponibilidade
 *
 * Retorna a grade de slots para uma data, com o status de cada quadra:
 *   - fora_operacao  → horário fora dos períodos de funcionamento
 *   - bloqueado      → reserva pendente de pagamento
 *   - confirmado     → reserva confirmada
 *   - disponivel     → livre para reservar
 *
 * Usa findAtivosByData para buscar todas as reservas ativas da data
 * em uma única query (em vez de N × M queries individuais).
 */
export async function consultarDisponibilidade(
  input: ConsultarDisponibilidadeInput,
): Promise<Resultado<DisponibilidadeConsultada>> {
  const { data, quadra_id } = input

  const slots_operacao = slotsOperacao(data)
  const todos = todosSlots()
  const quadras = quadra_id ? [quadra_id] : QUADRAS

  // Uma única query para todos os slots ativos da data
  const ativas = await reservaRepo.findAtivosByData(data, quadra_id)

  // Índice: "quadra_id-horario" → Reserva
  const ativasMap = new Map(ativas.map(r => [`${r.quadra_id}-${r.horario_inicio}`, r]))

  const slots: SlotDisponibilidade[] = []

  for (const horario of todos) {
    const operacao = slots_operacao.includes(horario)

    for (const qid of quadras) {
      if (!operacao) {
        slots.push({ quadra_id: qid, horario, status: 'fora_operacao', reserva_id: null })
        continue
      }

      const reserva = ativasMap.get(`${qid}-${horario}`)

      if (!reserva) {
        slots.push({ quadra_id: qid, horario, status: 'disponivel', reserva_id: null })
      } else if (reserva.status === 'bloqueada') {
        slots.push({ quadra_id: qid, horario, status: 'bloqueado', reserva_id: reserva.id })
      } else {
        slots.push({ quadra_id: qid, horario, status: 'confirmado', reserva_id: reserva.id })
      }
    }
  }

  return ok({ data, slots })
}
