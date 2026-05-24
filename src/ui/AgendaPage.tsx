import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConsultarDisponibilidade } from '@/integration/agenda/useConsultarDisponibilidade'
import { useReservaStore } from '@/store/reservaStore'
import type { StatusSlot } from '@/domain/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUADRAS = [
  { id: 1, nome: 'Quadra 1' },
  { id: 2, nome: 'Quadra 2' },
  { id: 3, nome: 'Quadra 3' },
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const STATUS_CONFIG: Record<StatusSlot, {
  bg: string
  text: string
  icon: string
  label: string
  clickable: boolean
}> = {
  disponivel: {
    bg: 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300 cursor-pointer active:scale-95',
    text: 'text-emerald-700',
    icon: '',
    label: 'Disponível',
    clickable: true,
  },
  bloqueado: {
    bg: 'bg-amber-100 border-amber-300 cursor-not-allowed',
    text: 'text-amber-700',
    icon: '⏳',
    label: 'Aguardando pag.',
    clickable: false,
  },
  confirmado: {
    bg: 'bg-red-100 border-red-300 cursor-not-allowed',
    text: 'text-red-600',
    icon: '✓',
    label: 'Reservado',
    clickable: false,
  },
  fora_operacao: {
    bg: 'bg-gray-100 border-gray-200 cursor-not-allowed',
    text: 'text-gray-300',
    icon: '—',
    label: 'Fechado',
    clickable: false,
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradeSkeletonLoader() {
  return (
    <div className="animate-pulse space-y-1.5">
      <div className="grid grid-cols-[56px_1fr_1fr_1fr] gap-1.5 mb-2">
        <div />
        {[1, 2, 3].map(i => <div key={i} className="h-5 bg-gray-200 rounded" />)}
      </div>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[56px_1fr_1fr_1fr] gap-1.5 items-center">
          <div className="h-4 bg-gray-100 rounded ml-2" />
          {[1, 2, 3].map(j => <div key={j} className="h-11 bg-gray-200 rounded-xl" />)}
        </div>
      ))}
    </div>
  )
}

// ─── AgendaPage ───────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const navigate = useNavigate()
  const setSlotSelecionado = useReservaStore(s => s.setSlotSelecionado)

  const dias = useMemo(gerarProximos7Dias, [])
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    // Se hoje for domingo, inicia no próximo dia útil (segunda)
    const primeiroDiaUtil = dias.find(d => d.getDay() !== 0) ?? dias[0]
    return toISODate(primeiroDiaUtil)
  })

  const { estado, slots, setData } = useConsultarDisponibilidade(dataSelecionada)

  const handleSelecionarDia = (date: Date) => {
    if (date.getDay() === 0) return
    const iso = toISODate(date)
    setDataSelecionada(iso)
    setData(iso)
  }

  // Horários únicos ordenados
  const horarios = useMemo(() => {
    const set = new Set(slots.map(s => s.horario))
    return Array.from(set).sort()
  }, [slots])

  // Mapa quadra+horario → slot
  const slotMap = useMemo(() => {
    const map = new Map<string, typeof slots[0]>()
    slots.forEach(s => map.set(`${s.quadra_id}-${s.horario}`, s))
    return map
  }, [slots])

  const handleSlotClick = (quadra_id: number, quadra_nome: string, horario: string) => {
    setSlotSelecionado({ quadra_id, quadra_nome, data: dataSelecionada, horario_inicio: horario })
    navigate('/reserva/identificacao')
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 py-3 shadow-sm" style={{ background: '#1B4332' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-base leading-tight">🎾 Beach Tennis</h1>
            <p className="text-emerald-200 text-xs">Reserve sua quadra</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="text-emerald-200 hover:text-white text-xs border border-emerald-600 hover:border-emerald-400 rounded-lg px-3 py-1.5 transition-colors"
          >
            Painel admin
          </button>
        </div>
      </header>

      {/* Seletor de data */}
      <div className="bg-white border-b border-gray-200 px-2 py-3 shadow-sm">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
          {dias.map((date) => {
            const iso = toISODate(date)
            const isDomingo = date.getDay() === 0
            const isSelected = iso === dataSelecionada
            return (
              <button
                key={iso}
                disabled={isDomingo}
                onClick={() => handleSelecionarDia(date)}
                className={[
                  'flex flex-col items-center min-w-[50px] rounded-xl py-2 px-1 transition-all border select-none',
                  isDomingo
                    ? 'opacity-35 border-transparent cursor-not-allowed'
                    : isSelected
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-700 active:bg-gray-200',
                ].join(' ')}
                style={isSelected && !isDomingo ? { background: '#1B4332' } : {}}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {DIAS_SEMANA[date.getDay()]}
                </span>
                <span className={`text-xl font-bold leading-tight ${isDomingo ? 'line-through' : ''}`}>
                  {date.getDate()}
                </span>
                <span className="text-[10px]">{MESES_CURTOS[date.getMonth()]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Grade de horários */}
      <div className="flex-1 overflow-auto px-3 pt-3 pb-6">
        {estado === 'carregando' ? (
          <GradeSkeletonLoader />
        ) : estado === 'erro-conexao' ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📡</p>
            <p className="text-gray-500 font-medium">Falha de conexão</p>
            <p className="text-gray-400 text-sm mt-1">Verifique sua internet e tente novamente.</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho das quadras */}
            <div className="grid grid-cols-[56px_1fr_1fr_1fr] gap-1.5 mb-1.5">
              <div />
              {QUADRAS.map(q => (
                <div key={q.id} className="text-center text-xs font-bold text-gray-500 uppercase tracking-wide py-1">
                  {q.nome}
                </div>
              ))}
            </div>

            {/* Linhas de horários */}
            {horarios.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🚫</p>
                <p className="text-gray-500 font-medium">Sem operação neste dia</p>
                <p className="text-gray-400 text-sm mt-1">Domingo é dia de descanso.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {horarios.map(horario => (
                  <div
                    key={horario}
                    className="grid grid-cols-[56px_1fr_1fr_1fr] gap-1.5 items-center"
                  >
                    <div className="text-right text-xs text-gray-400 pr-2 font-semibold tabular-nums">
                      {horario}
                    </div>
                    {QUADRAS.map(q => {
                      const slot = slotMap.get(`${q.id}-${horario}`)
                      const status: StatusSlot = slot?.status ?? 'fora_operacao'
                      const cfg = STATUS_CONFIG[status]
                      return (
                        <button
                          key={q.id}
                          disabled={!cfg.clickable}
                          onClick={() => cfg.clickable && handleSlotClick(q.id, q.nome, horario)}
                          className={[
                            'h-11 rounded-xl border text-sm font-medium transition-all select-none',
                            cfg.bg,
                            cfg.text,
                          ].join(' ')}
                          title={cfg.label}
                          aria-label={`${q.nome} ${horario} — ${cfg.label}`}
                        >
                          {cfg.icon}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Legenda */}
            {horarios.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">
                  Legenda
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {([
                    { cor: 'bg-emerald-100 border-emerald-300', label: 'Disponível' },
                    { cor: 'bg-amber-100 border-amber-300', label: 'Aguardando pagamento' },
                    { cor: 'bg-red-100 border-red-300', label: 'Reservado' },
                    { cor: 'bg-gray-100 border-gray-200', label: 'Fora de operação' },
                  ] as const).map(({ cor, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border shrink-0 ${cor}`} />
                      <span className="text-xs text-gray-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
