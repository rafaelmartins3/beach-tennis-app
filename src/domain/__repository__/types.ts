import type { Reserva, Cliente } from '../types.js'

// ─── ReservaRepository ────────────────────────────────────────────────────────

export interface ReservaRepository {
  /** Todas as reservas (admin / expiração em lote) */
  all(): Promise<Reserva[]>

  findById(id: string): Promise<Reserva | undefined>

  /** Reserva ativa (bloqueada ou confirmada) para um slot específico */
  findAtivo(
    quadra_id: number,
    data: string,
    horario_inicio: string,
  ): Promise<Reserva | undefined>

  /**
   * Todas as reservas ativas de uma data — usada por consultarDisponibilidade
   * para uma única query ao invés de N × M individuais.
   */
  findAtivosByData(data: string, quadra_id?: number): Promise<Reserva[]>

  save(r: Reserva): Promise<Reserva>
  update(id: string, patch: Partial<Reserva>): Promise<Reserva | undefined>

  /** Reservas bloqueadas com janela expirada */
  vencidas(): Promise<Reserva[]>

  /**
   * ATÔMICO — salva apenas se o slot estiver livre.
   * Previne double-booking em concorrência:
   *   - Mem: check+save síncronos dentro de um único bloco (sem yield points)
   *   - Supabase: INSERT protegido pelo unique index parcial uq_reserva_slot_ativo
   */
  salvarSeDisponivel(r: Reserva): Promise<{ salvo: boolean }>

  /**
   * ATÔMICO — confirma a reserva somente se ainda estiver 'bloqueada'.
   * Retorna undefined se outra operação já alterou o status.
   */
  confirmarSePendente(
    id: string,
    patch: Pick<Reserva, 'status' | 'comprovante_url' | 'confirmado_at'>,
  ): Promise<Reserva | undefined>

  /**
   * ATÔMICO — expira a reserva somente se ainda estiver 'bloqueada'.
   * Retorna true se expirou, false se status já era diferente de 'bloqueada'.
   */
  expirarSePendente(id: string): Promise<boolean>
}

// ─── ClienteRepository ────────────────────────────────────────────────────────

export interface ClienteRepository {
  findByCpf(cpf: string): Promise<Cliente | undefined>
  save(c: Cliente): Promise<Cliente>

  /**
   * ATÔMICO — registra se CPF não existe, localiza se já existe.
   * Previne duplo cadastro em concorrência:
   *   - Mem: check+save síncronos dentro de um único bloco (sem yield points)
   *   - Supabase: INSERT protegido pelo unique constraint em clientes.cpf
   */
  encontrarOuSalvar(c: Cliente): Promise<{ criado: boolean; cliente: Cliente }>
}

// ─── ArquivoRepository ───────────────────────────────────────────────────────

export interface ArquivoRepository {
  /** Faz upload do arquivo e retorna a URL pública */
  save(reserva_id: string, arquivo: File): Promise<string>
  findByReserva(reserva_id: string): Promise<string | undefined>
}
