/**
 * Regras de operação do espaço.
 * Seg–Sex: 08h–11h e 14h–22h  (slots: 08,09,10 e 14..21)
 * Sáb:     07h–12h             (slots: 07,08,09,10,11)
 * Dom:     fechado
 */

const SLOTS_SEG_SEX = [
  '08:00', '09:00', '10:00',                                    // manhã
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', // tarde/noite
]

const SLOTS_SABADO = ['07:00', '08:00', '09:00', '10:00', '11:00']

// Todos os horários possíveis que exibimos na grade (06h–22h)
const TODOS_SLOTS = Array.from({ length: 17 }, (_, i) => {
  const h = String(i + 6).padStart(2, '0')
  return `${h}:00`
}) // 06:00 .. 22:00

export const QUADRAS = [1, 2, 3]

/**
 * Dado uma data ISO (YYYY-MM-DD), retorna os slots que estão
 * dentro do período de operação.
 */
export function slotsOperacao(data: string): string[] {
  const dow = diaSemana(data)
  if (dow === 0) return []                       // domingo
  if (dow === 6) return SLOTS_SABADO             // sábado
  return SLOTS_SEG_SEX                           // seg–sex
}

/**
 * Retorna TODOS os horários da grade, para exibição (incluindo fora de operação).
 */
export function todosSlots(): string[] {
  return TODOS_SLOTS
}

/**
 * Verifica se um horário está dentro do período de operação.
 */
export function dentroDeOperacao(data: string, horario: string): boolean {
  return slotsOperacao(data).includes(horario)
}

/**
 * Dia da semana: 0=dom, 1=seg, ..., 6=sab
 * Usa UTC para evitar problemas de fuso.
 */
function diaSemana(data: string): number {
  const [y, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
