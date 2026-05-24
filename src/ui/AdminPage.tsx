import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpiracaoAutomatica } from '@/integration/reservas/useLiberarQuadra'
import { storeReservas, storeClientes } from '@/domain/__store__/index'
import type { Reserva, Cliente, StatusReserva } from '@/domain/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const QUADRA_NOMES: Record<number, string> = {
  1: 'Quadra 1',
  2: 'Quadra 2',
  3: 'Quadra 3',
}

const STATUS_BADGE: Record<StatusReserva, { label: string; classes: string }> = {
  bloqueada: {
    label: 'Aguardando',
    classes: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  confirmada: {
    label: 'Confirmado ✓',
    classes: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  expirada: {
    label: 'Expirado',
    classes: 'bg-gray-100 text-gray-500 border-gray-200',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function gerarProximos7Dias(): Date[] {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() + i)
    return d
  })
}

function formatarHorario(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface ReservaAdmin extends Reserva {
  cliente?: Cliente
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const navigate = useNavigate()
  const dias = useMemo(gerarProximos7Dias, [])

  const [dataSelecionada, setDataSelecionada] = useState(() => toISODate(dias[0]))
  const [filtroQuadra, setFiltroQuadra] = useState<number | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)

  // Job de expiração automática (a cada minuto)
  useExpiracaoAutomatica(60_000)

  // Força re-render periódico para atualizar dados do store
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  // Lê reservas do store e enriquece com dados do cliente
  const reservas = useMemo<ReservaAdmin[]>(() => {
    return storeReservas
      .all()
      .filter(r => r.data === dataSelecionada)
      .filter(r => filtroQuadra === null || r.quadra_id === filtroQuadra)
      .map(r => ({ ...r, cliente: storeClientes.findByCpf(r.cpf_cliente) }))
      .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSelecionada, filtroQuadra, tick])

  const stats = useMemo(() => ({
    total: reservas.length,
    aguardando: reservas.filter(r => r.status === 'bloqueada').length,
    confirmados: reservas.filter(r => r.status === 'confirmada').length,
    expirados: reservas.filter(r => r.status === 'expirada').length,
  }), [reservas])

  const handleSelecionarDia = (date: Date) => {
    if (date.getDay() === 0) return
    setDataSelecionada(toISODate(date))
    setExpandida(null)
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 py-3 shadow-sm" style={{ background: '#1B4332' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-base">📋 Painel Admin</h1>
            <p className="text-emerald-200 text-xs">Agendamentos do dia</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-emerald-200 hover:text-white text-xs border border-emerald-600 hover:border-emerald-400 rounded-lg px-3 py-1.5 transition-colors"
          >
            ← Agenda
          </button>
        </div>
      </header>

      {/* Seletor de data */}
      <div className="bg-white border-b border-gray-200 px-2 py-3">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {dias.map(date => {
            const iso = toISODate(date)
            const isDomingo = date.getDay() === 0
            const isSelected = iso === dataSelecionada
            return (
              <button
                key={iso}
                disabled={isDomingo}
                onClick={() => handleSelecionarDia(date)}
                className={[
                  'flex flex-col items-center min-w-[50px] rounded-xl py-2 px-1 border transition-all',
                  isDomingo
                    ? 'opacity-35 border-transparent cursor-not-allowed'
                    : isSelected
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-700',
                ].join(' ')}
                style={isSelected && !isDomingo ? { background: '#1B4332' } : {}}
              >
                <span className="text-[10px] font-semibold uppercase">
                  {DIAS_SEMANA[date.getDay()]}
                </span>
                <span className="text-xl font-bold leading-tight">{date.getDate()}</span>
                <span className="text-[10px]">{MESES_CURTOS[date.getMonth()]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtro por quadra */}
      <div className="bg-white border-b border-gray-200 px-3 py-2.5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {([null, 1, 2, 3] as const).map(id => (
            <button
              key={id ?? 'todas'}
              onClick={() => setFiltroQuadra(id)}
              className={[
                'text-xs px-4 py-1.5 rounded-full border transition-colors font-semibold whitespace-nowrap',
                filtroQuadra === id
                  ? 'text-white border-transparent'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
              ].join(' ')}
              style={filtroQuadra === id ? { background: '#1B4332' } : {}}
            >
              {id === null ? 'Todas as quadras' : `Quadra ${id}`}
            </button>
          ))}
        </div>
      </div>

      {/* Estatísticas */}
      {reservas.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.aguardando}</p>
              <p className="text-xs text-gray-400">Aguardando</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.confirmados}</p>
              <p className="text-xs text-gray-400">Confirmados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{stats.expirados}</p>
              <p className="text-xs text-gray-400">Expirados</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de reservas */}
      <div className="flex-1 px-3 py-3 space-y-2 overflow-auto">
        {reservas.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📅</p>
            <p className="text-gray-500 font-medium">Nenhuma reserva encontrada</p>
            <p className="text-gray-400 text-sm mt-1">
              {filtroQuadra !== null
                ? `Sem reservas para ${QUADRA_NOMES[filtroQuadra]} neste dia.`
                : 'Nenhuma reserva para este dia.'}
            </p>
          </div>
        ) : (
          reservas.map(r => {
            const badge = STATUS_BADGE[r.status]
            const isExpanded = expandida === r.id

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
              >
                {/* Cabeçalho do card */}
                <button
                  className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3"
                  onClick={() => setExpandida(isExpanded ? null : r.id)}
                >
                  {/* Horário */}
                  <div className="text-center shrink-0 min-w-[42px]">
                    <p className="text-sm font-bold text-gray-800 tabular-nums">
                      {r.horario_inicio}
                    </p>
                    <p className="text-xs text-gray-400 tabular-nums">{r.horario_fim}</p>
                  </div>

                  {/* Divisor */}
                  <div className="w-px h-8 bg-gray-200 shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {QUADRA_NOMES[r.quadra_id]}
                    </p>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {r.cliente?.nome ?? r.cpf_cliente}
                    </p>
                  </div>

                  {/* Status badge + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${badge.classes}`}>
                      {badge.label}
                    </span>
                    <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                          CPF
                        </p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">
                          {r.cpf_cliente}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                          Telefone
                        </p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">
                          {r.cliente?.telefone ?? '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                          Criado
                        </p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">
                          {new Date(r.criado_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {r.confirmado_at && (
                        <div>
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                            Confirmado
                          </p>
                          <p className="text-sm font-medium text-gray-700 mt-0.5">
                            {new Date(r.confirmado_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Expiração (reservas aguardando) */}
                    {r.status === 'bloqueada' && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <p className="text-xs text-amber-700 font-medium">
                          ⏱ Expira às {formatarHorario(r.janela_expiracao_at)}
                        </p>
                      </div>
                    )}

                    {/* Comprovante */}
                    {r.comprovante_url ? (
                      <div className="mt-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
                          Comprovante
                        </p>
                        <a
                          href={r.comprovante_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 font-semibold border border-emerald-200 bg-white rounded-xl px-4 py-2 transition-colors hover:bg-emerald-50"
                        >
                          📎 Ver comprovante
                        </a>
                      </div>
                    ) : (
                      r.status !== 'expirada' && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
                            Comprovante
                          </p>
                          <p className="text-sm text-gray-400 italic">Aguardando envio...</p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
