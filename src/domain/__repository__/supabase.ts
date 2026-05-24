/**
 * Implementações Supabase dos repositórios.
 * Usadas em produção quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas.
 *
 * As operações atômicas usam constraints do PostgreSQL para garantir
 * exclusão mútua no banco — sem locks de aplicação necessários.
 */

import { supabase } from '../../lib/supabase.js'
import type { ReservaRepository, ClienteRepository, ArquivoRepository } from './types.js'
import type { Reserva, Cliente } from '../types.js'

const BUCKET = 'comprovantes'

// ─── ReservaRepository ────────────────────────────────────────────────────────

export const supabaseReservaRepo: ReservaRepository = {
  async all() {
    const { data, error } = await supabase.from('reservas').select('*')
    if (error) throw error
    return (data ?? []) as Reserva[]
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return (data as Reserva) ?? undefined
  },

  async findAtivo(quadra_id, data, horario_inicio) {
    const { data: rows, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('quadra_id', quadra_id)
      .eq('data', data)
      .eq('horario_inicio', horario_inicio)
      .in('status', ['bloqueada', 'confirmada'])
      .limit(1)
    if (error) throw error
    return (rows?.[0] as Reserva) ?? undefined
  },

  async findAtivosByData(data, quadra_id) {
    let query = supabase
      .from('reservas')
      .select('*')
      .eq('data', data)
      .in('status', ['bloqueada', 'confirmada'])

    if (quadra_id !== undefined) query = query.eq('quadra_id', quadra_id)

    const { data: rows, error } = await query
    if (error) throw error
    return (rows ?? []) as Reserva[]
  },

  async save(r) {
    const { data, error } = await supabase
      .from('reservas')
      .insert(r)
      .select()
      .single()
    if (error) throw error
    return data as Reserva
  },

  async update(id, patch) {
    const { data, error } = await supabase
      .from('reservas')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return (data as Reserva) ?? undefined
  },

  async vencidas() {
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('status', 'bloqueada')
      .lt('janela_expiracao_at', new Date().toISOString())
    if (error) throw error
    return (data ?? []) as Reserva[]
  },

  // ── Operações atômicas ──────────────────────────────────────────────────────

  async salvarSeDisponivel(r) {
    // O unique index parcial uq_reserva_slot_ativo no PostgreSQL garante
    // que apenas uma linha com status IN ('bloqueada','confirmada') exista
    // para (quadra_id, data, horario_inicio) — sem lock de aplicação.
    const { error } = await supabase.from('reservas').insert(r)
    if (error) {
      if (error.code === '23505') return { salvo: false } // unique violation
      throw error
    }
    return { salvo: true }
  },

  async confirmarSePendente(id, patch) {
    // UPDATE ... WHERE status = 'bloqueada' — atômico no PostgreSQL.
    // Retorna a linha atualizada, ou null se status já era diferente.
    const { data, error } = await supabase
      .from('reservas')
      .update(patch)
      .eq('id', id)
      .eq('status', 'bloqueada')
      .select()
      .maybeSingle()
    if (error) throw error
    return (data as Reserva) ?? undefined
  },

  async expirarSePendente(id) {
    // UPDATE ... WHERE status = 'bloqueada' — retorna a linha se atualizou.
    const { data, error } = await supabase
      .from('reservas')
      .update({ status: 'expirada' })
      .eq('id', id)
      .eq('status', 'bloqueada')
      .select('id')
      .maybeSingle()
    if (error) throw error
    return data !== null
  },
}

// ─── ClienteRepository ────────────────────────────────────────────────────────

export const supabaseClienteRepo: ClienteRepository = {
  async findByCpf(cpf) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('cpf', cpf)
      .maybeSingle()
    if (error) throw error
    return (data as Cliente) ?? undefined
  },

  async save(c) {
    const { data, error } = await supabase
      .from('clientes')
      .insert(c)
      .select()
      .single()
    if (error) throw error
    return data as Cliente
  },

  async encontrarOuSalvar(c) {
    // Tenta INSERT; se violar unique constraint em cpf, busca o existente.
    const { data, error } = await supabase
      .from('clientes')
      .insert(c)
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        // Duplicate CPF — localiza o registro existente
        const existing = await supabaseClienteRepo.findByCpf(c.cpf)
        return { criado: false, cliente: existing! }
      }
      throw error
    }

    return { criado: true, cliente: data as Cliente }
  },
}

// ─── ArquivoRepository ────────────────────────────────────────────────────────

export const supabaseArquivoRepo: ArquivoRepository = {
  async save(reserva_id, arquivo) {
    const path = `${reserva_id}/${arquivo.name}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arquivo, { upsert: true })
    if (error) throw error

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  },

  async findByReserva(reserva_id) {
    const { data } = await supabase.storage.from(BUCKET).list(reserva_id)
    if (!data || data.length === 0) return undefined
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(`${reserva_id}/${data[0].name}`)
    return urlData.publicUrl
  },
}
