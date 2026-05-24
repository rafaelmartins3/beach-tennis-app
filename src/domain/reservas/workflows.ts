import type {
  IniciarReservaInput,
  AnexarComprovanteInput,
  LiberarQuadraInput,
  ReservaIniciada,
  ReservaConfirmada,
  QuadraLiberada,
  ReservasExpiradas,
  Resultado,
  Reserva,
} from '../types.js'
import { ok, erro } from '../types.js'
import { reservaRepo, arquivoRepo } from '../__repository__/index.js'
import { dentroDeOperacao } from '../agenda/operacao.js'
import { randomUUID } from '../__store__/uuid.js'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MIME_ACEITOS = ['image/jpeg', 'image/png', 'application/pdf']
const JANELA_MS = 2 * 60 * 60 * 1000  // 2 horas em ms

// ─── IniciarReserva ───────────────────────────────────────────────────────────

export async function iniciarReserva(
  input: IniciarReservaInput,
): Promise<Resultado<ReservaIniciada>> {
  const { quadra_id, data, horario_inicio, cpf_cliente } = input

  // Regra: horário dentro do período de operação
  if (!dentroDeOperacao(data, horario_inicio)) {
    return erro({ code: 'HORARIO_FORA_DE_OPERACAO', data, horario: horario_inicio })
  }

  const agora = new Date()
  const expiracao = new Date(agora.getTime() + JANELA_MS)
  const [h] = horario_inicio.split(':')
  const horario_fim = `${String(Number(h) + 1).padStart(2, '0')}:00`

  const reserva: Reserva = {
    id: randomUUID(),
    quadra_id,
    cpf_cliente,
    data,
    horario_inicio,
    horario_fim,
    status: 'bloqueada',
    comprovante_url: null,
    janela_expiracao_at: expiracao.toISOString(),
    criado_at: agora.toISOString(),
    confirmado_at: null,
  }

  // ATÔMICO: salva apenas se o slot estiver livre — previne double-booking
  const { salvo } = await reservaRepo.salvarSeDisponivel(reserva)
  if (!salvo) {
    return erro({ code: 'QUADRA_NAO_DISPONIVEL', quadra_id, data, horario: horario_inicio })
  }

  return ok({ reserva, janela_expiracao_at: reserva.janela_expiracao_at })
}

// ─── AnexarComprovante ────────────────────────────────────────────────────────

export async function anexarComprovante(
  input: AnexarComprovanteInput,
): Promise<Resultado<ReservaConfirmada>> {
  const { reserva_id, arquivo } = input

  // Validação do arquivo
  if (!MIME_ACEITOS.includes(arquivo.type)) {
    return erro({ code: 'ARQUIVO_INVALIDO', motivo: 'formato_nao_suportado' })
  }
  if (arquivo.size > MAX_FILE_SIZE) {
    return erro({ code: 'ARQUIVO_INVALIDO', motivo: 'tamanho_excedido' })
  }

  // Busca a reserva
  const reserva = await reservaRepo.findById(reserva_id)
  if (!reserva) {
    return erro({ code: 'RESERVA_NAO_ENCONTRADA', reserva_id })
  }

  // Reserva já confirmada
  if (reserva.status === 'confirmada') {
    return erro({ code: 'RESERVA_JA_CONFIRMADA', reserva_id })
  }

  // Reserva expirada (status ou janela)
  if (reserva.status === 'expirada' || new Date(reserva.janela_expiracao_at) < new Date()) {
    return erro({
      code: 'JANELA_EXPIRADA',
      reserva_id,
      expirou_at: reserva.janela_expiracao_at,
    })
  }

  // Faz upload e obtém URL pública
  const comprovante_url = await arquivoRepo.save(reserva_id, arquivo)

  // ATÔMICO: confirma somente se ainda 'bloqueada' — previne dupla confirmação
  const agora = new Date().toISOString()
  const atualizada = await reservaRepo.confirmarSePendente(reserva_id, {
    status: 'confirmada',
    comprovante_url,
    confirmado_at: agora,
  })

  if (!atualizada) {
    // Outra operação já alterou o status — descobre qual para retornar o erro correto
    const atual = await reservaRepo.findById(reserva_id)
    if (atual?.status === 'confirmada') {
      return erro({ code: 'RESERVA_JA_CONFIRMADA', reserva_id })
    }
    return erro({ code: 'JANELA_EXPIRADA', reserva_id, expirou_at: reserva.janela_expiracao_at })
  }

  return ok({ reserva: atualizada, comprovante_url })
}

// ─── LiberarQuadra ────────────────────────────────────────────────────────────

export async function liberarQuadra(
  input: LiberarQuadraInput,
): Promise<Resultado<QuadraLiberada>> {
  const { reserva_id } = input

  // Precisamos dos dados da reserva para o retorno — busca antes de expirar
  const reserva = await reservaRepo.findById(reserva_id)
  if (!reserva) {
    return erro({ code: 'RESERVA_NAO_ENCONTRADA', reserva_id })
  }

  // ATÔMICO: expira somente se ainda 'bloqueada' — previne conflito com confirmação
  const expirou = await reservaRepo.expirarSePendente(reserva_id)
  if (!expirou) {
    // Status já era diferente de 'bloqueada' (confirmada ou já expirada)
    return erro({ code: 'RESERVA_NAO_ENCONTRADA', reserva_id })
  }

  return ok({
    reserva_id,
    quadra_id: reserva.quadra_id,
    data: reserva.data,
    horario_inicio: reserva.horario_inicio,
  })
}

// ─── expirarReservasVencidas (job automático) ─────────────────────────────────

export async function expirarReservasVencidas(): Promise<ReservasExpiradas> {
  const vencidas = await reservaRepo.vencidas()
  const liberadas: string[] = []

  for (const r of vencidas) {
    // ATÔMICO: expira somente se ainda 'bloqueada' (pode ter sido confirmada entre vencidas() e agora)
    const expirou = await reservaRepo.expirarSePendente(r.id)
    if (expirou) liberadas.push(r.id)
  }

  return { liberadas }
}
