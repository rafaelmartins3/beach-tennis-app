// ─── Status ──────────────────────────────────────────────────────────────────

export type StatusReserva = 'bloqueada' | 'confirmada' | 'expirada'

export type StatusSlot = 'disponivel' | 'bloqueado' | 'confirmado' | 'fora_operacao'

// ─── Entidades ────────────────────────────────────────────────────────────────

export interface Quadra {
  id: number
  nome: string
}

export interface Cliente {
  id: string
  cpf: string
  nome: string
  telefone: string
  criado_at: string
}

export interface Reserva {
  id: string
  quadra_id: number
  cpf_cliente: string
  data: string
  horario_inicio: string
  horario_fim: string
  status: StatusReserva
  comprovante_url: string | null
  janela_expiracao_at: string
  criado_at: string
  confirmado_at: string | null
}

export interface SlotDisponibilidade {
  quadra_id: number
  horario: string
  status: StatusSlot
  reserva_id: string | null
}

// ─── Inputs (comandos) ────────────────────────────────────────────────────────

export interface ConsultarDisponibilidadeInput {
  data: string
  quadra_id?: number
}

export interface IniciarReservaInput {
  quadra_id: number
  data: string
  horario_inicio: string
  cpf_cliente: string
}

export interface RegistrarClienteInput {
  cpf: string
  nome?: string
  telefone?: string
}

export interface AnexarComprovanteInput {
  reserva_id: string
  arquivo: File
}

export interface LiberarQuadraInput {
  reserva_id: string
}

// ─── Outputs (eventos) ────────────────────────────────────────────────────────

export interface DisponibilidadeConsultada {
  data: string
  slots: SlotDisponibilidade[]
}

export interface ReservaIniciada {
  reserva: Reserva
  janela_expiracao_at: string
}

export interface ClienteLocalizado {
  cliente: Cliente
  tipo: 'localizado'
}

export interface ClienteRegistrado {
  cliente: Cliente
  tipo: 'registrado'
}

export interface ReservaConfirmada {
  reserva: Reserva
  comprovante_url: string
}

export interface QuadraLiberada {
  reserva_id: string
  quadra_id: number
  data: string
  horario_inicio: string
}

export interface ReservasExpiradas {
  liberadas: string[]
}

// ─── Erros de domínio ────────────────────────────────────────────────────────

export type ErroDominio =
  | { code: 'QUADRA_NAO_DISPONIVEL'; quadra_id: number; data: string; horario: string; motivo?: never }
  | { code: 'HORARIO_FORA_DE_OPERACAO'; data: string; horario: string; motivo?: never }
  | { code: 'CPF_INVALIDO'; cpf: string; motivo?: never }
  | { code: 'RESERVA_NAO_ENCONTRADA'; reserva_id: string; motivo?: never }
  | { code: 'JANELA_EXPIRADA'; reserva_id: string; expirou_at: string; motivo?: never }
  | { code: 'ARQUIVO_INVALIDO'; motivo: 'formato_nao_suportado' | 'tamanho_excedido' }
  | { code: 'RESERVA_JA_CONFIRMADA'; reserva_id: string; motivo?: never }

// ─── Resultado genérico ───────────────────────────────────────────────────────

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; erro: ErroDominio }

export const ok = <T>(data: T): Resultado<T> => ({ ok: true, data })
export const erro = (e: ErroDominio): Resultado<never> => ({ ok: false, erro: e })
