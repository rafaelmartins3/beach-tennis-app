import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useReservaStore } from '@/store/reservaStore'
import { useRegistrarCliente } from '@/integration/clientes/useRegistrarCliente'
import { useIniciarReserva } from '@/integration/reservas/useIniciarReserva'
import { useAnexarComprovante } from '@/integration/reservas/useAnexarComprovante'
import { cpfValido, limparCpf } from '@/domain/clientes/cpf'

// ─── Utilities ────────────────────────────────────────────────────────────────

function mascaraCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function formatarDataExibicao(iso: string): string {
  const [year, month, day] = iso.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${day} ${meses[parseInt(month) - 1]} ${year}`
}

function formatarTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function useContagem(expiresAt: string | null): number {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSegundos(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return segundos
}

// ─── Layout compartilhado ─────────────────────────────────────────────────────

interface FlowLayoutProps {
  title: string
  children: React.ReactNode
  showBack?: boolean
}

function FlowLayout({ title, children, showBack = true }: FlowLayoutProps) {
  const navigate = useNavigate()
  return (
    <div className="max-w-[480px] mx-auto min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 px-4 py-3 shadow-sm" style={{ background: '#1B4332' }}>
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="text-white text-xl leading-none px-1 hover:text-emerald-200 transition-colors"
              aria-label="Voltar"
            >
              ←
            </button>
          )}
          <h1 className="text-white font-semibold">{title}</h1>
        </div>
      </header>
      <div className="flex-1 px-4 py-5">{children}</div>
    </div>
  )
}

// ─── Resumo do slot selecionado ───────────────────────────────────────────────

function ResumoSlot() {
  const slot = useReservaStore(s => s.slotSelecionado)
  if (!slot) return null
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5">
      <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wide mb-1">
        Horário selecionado
      </p>
      <p className="font-bold text-emerald-900">{slot.quadra_nome}</p>
      <p className="text-sm text-emerald-700 mt-0.5">
        {formatarDataExibicao(slot.data)} · {slot.horario_inicio}h
      </p>
    </div>
  )
}

// ─── Step 1 — Identificação por CPF ──────────────────────────────────────────

function IdentificacaoStep() {
  const navigate = useNavigate()
  const slot = useReservaStore(s => s.slotSelecionado)
  const { setCliente: salvarCliente, setReserva: salvarReserva, setCpfPendente } = useReservaStore()

  const { estado: estadoCli, cliente, identificar } = useRegistrarCliente()
  const { estado: estadoRes, reserva, janelaExpiracao, iniciar } = useIniciarReserva()

  const [cpf, setCpf] = useState('')
  const [erroFormato, setErroFormato] = useState(false)
  const iniciouRef = useRef(false)

  if (!slot) return <Navigate to="/" replace />

  // Após cliente localizado (existente) → inicia reserva
  useEffect(() => {
    if (
      estadoCli === 'cpf-valido' &&
      cliente &&
      !iniciouRef.current
    ) {
      iniciouRef.current = true
      iniciar({
        quadra_id: slot.quadra_id,
        data: slot.data,
        horario_inicio: slot.horario_inicio,
        cpf_cliente: cliente.cpf,
      })
    }
  }, [estadoCli, cliente, slot, iniciar])

  // Após reserva criada → salva e vai para comprovante
  useEffect(() => {
    if (estadoRes === 'bloqueado' && reserva && janelaExpiracao && cliente) {
      salvarCliente(cliente)
      salvarReserva(reserva, janelaExpiracao.toISOString())
      navigate('/reserva/comprovante')
    }
  }, [estadoRes, reserva, janelaExpiracao, cliente, salvarCliente, salvarReserva, navigate])

  // Após cpf-invalido: se formato era válido → CPF é novo → vai para contato
  useEffect(() => {
    if (estadoCli === 'cpf-invalido') {
      const raw = limparCpf(cpf)
      if (cpfValido(raw)) {
        // CPF válido mas novo — precisa de dados de contato
        setCpfPendente(raw)
        navigate('/reserva/contato')
      }
      // Senão: formato inválido → erroFormato já está setado pelo handleSubmit
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoCli])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = limparCpf(cpf)
    if (!cpfValido(raw)) {
      setErroFormato(true)
      return
    }
    setErroFormato(false)
    identificar(raw)
  }

  const isLoading =
    estadoCli === 'carregando' ||
    estadoRes === 'carregando' ||
    estadoRes === 'bloqueado'

  const mostrarErroCpf = erroFormato
  const mostrarErroQuadra = estadoRes === 'quadra-indisponivel'

  return (
    <FlowLayout title="Identificação">
      <ResumoSlot />

      <h2 className="text-lg font-bold text-gray-800 mb-1">Qual é o seu CPF?</h2>
      <p className="text-sm text-gray-500 mb-6">
        Usamos o CPF para identificar sua reserva. Nenhuma senha necessária.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">CPF</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={cpf}
            onChange={e => {
              setCpf(mascaraCpf(e.target.value))
              setErroFormato(false)
            }}
            placeholder="000.000.000-00"
            className={[
              'w-full border rounded-2xl px-4 py-3.5 text-xl tracking-widest outline-none transition-colors font-mono',
              mostrarErroCpf
                ? 'border-red-400 bg-red-50 text-red-900 focus:border-red-500'
                : 'border-gray-300 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
            ].join(' ')}
          />
          {mostrarErroCpf && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
              ⚠️ CPF inválido. Verifique os dígitos e tente novamente.
            </p>
          )}
          {mostrarErroQuadra && (
            <p className="mt-2 text-sm text-amber-600 flex items-center gap-1">
              ⚠️ Este horário acabou de ser reservado. Volte e escolha outro slot.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={limparCpf(cpf).length !== 11 || isLoading}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all disabled:opacity-40 active:scale-95"
          style={{ background: '#1B4332' }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⟳</span> Verificando...
            </span>
          ) : (
            'Continuar'
          )}
        </button>
      </form>
    </FlowLayout>
  )
}

// ─── Step 2 — Dados de contato (novos clientes) ───────────────────────────────

function ContatoStep() {
  const navigate = useNavigate()
  const slot = useReservaStore(s => s.slotSelecionado)
  const cpfPendente = useReservaStore(s => s.cpfPendente)
  const { setCliente: salvarCliente, setReserva: salvarReserva } = useReservaStore()

  const { completarCadastro, estado: estadoCli, cliente: clienteAtualizado } = useRegistrarCliente()
  const { estado: estadoRes, reserva, janelaExpiracao, iniciar } = useIniciarReserva()

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const iniciouRef = useRef(false)

  if (!slot || !cpfPendente) return <Navigate to="/" replace />

  // Após completar cadastro → inicia reserva
  useEffect(() => {
    if (estadoCli === 'cpf-valido' && clienteAtualizado && !iniciouRef.current) {
      iniciouRef.current = true
      salvarCliente(clienteAtualizado)
      iniciar({
        quadra_id: slot.quadra_id,
        data: slot.data,
        horario_inicio: slot.horario_inicio,
        cpf_cliente: clienteAtualizado.cpf,
      })
    }
  }, [estadoCli, clienteAtualizado, slot, iniciar, salvarCliente])

  // Após reserva criada → salva e vai para comprovante
  useEffect(() => {
    if (estadoRes === 'bloqueado' && reserva && janelaExpiracao) {
      salvarReserva(reserva, janelaExpiracao.toISOString())
      navigate('/reserva/comprovante')
    }
  }, [estadoRes, reserva, janelaExpiracao, salvarReserva, navigate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    completarCadastro(cpfPendente, {
      nome: nome.trim(),
      telefone: limparCpf(telefone), // reutiliza limparCpf para remover máscara
    })
  }

  const canSubmit =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, '').length >= 10

  const isLoading = estadoCli === 'carregando' || estadoRes === 'carregando'

  return (
    <FlowLayout title="Dados de Contato">
      <ResumoSlot />

      <h2 className="text-lg font-bold text-gray-800 mb-1">Primeiro acesso</h2>
      <p className="text-sm text-gray-500 mb-6">
        Preencha seus dados para completar o cadastro.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Nome completo
          </label>
          <input
            type="text"
            autoComplete="name"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Seu nome"
            className="w-full border border-gray-300 rounded-2xl px-4 py-3.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-colors bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Telefone / WhatsApp
          </label>
          <input
            type="text"
            inputMode="tel"
            autoComplete="tel"
            value={telefone}
            onChange={e => setTelefone(mascaraTelefone(e.target.value))}
            placeholder="(00) 00000-0000"
            className="w-full border border-gray-300 rounded-2xl px-4 py-3.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-colors bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit || isLoading}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all disabled:opacity-40 active:scale-95"
          style={{ background: '#1B4332' }}
        >
          {isLoading ? 'Processando...' : 'Confirmar dados'}
        </button>
      </form>
    </FlowLayout>
  )
}

// ─── Step 3 — Envio do comprovante ────────────────────────────────────────────

const PIX_CHAVE = 'beach-tennis@exemplo.com.br'
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'application/pdf']

function ComprovanteStep() {
  const navigate = useNavigate()
  const slot = useReservaStore(s => s.slotSelecionado)
  const reserva = useReservaStore(s => s.reserva)
  const janelaExpiracao = useReservaStore(s => s.janelaExpiracao)
  const resetar = useReservaStore(s => s.resetar)

  const { estado, arquivoSelecionado, reservaConfirmada, selecionarArquivo, enviar } =
    useAnexarComprovante()

  const segundos = useContagem(janelaExpiracao)
  const expirado = janelaExpiracao !== null && segundos === 0

  const [copiado, setCopiado] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  if (!reserva || !slot) return <Navigate to="/" replace />

  // Navega para confirmada após sucesso
  useEffect(() => {
    if (estado === 'reserva-confirmada' && reservaConfirmada) {
      navigate('/reserva/confirmada')
    }
  }, [estado, reservaConfirmada, navigate])

  const handleCopiarPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_CHAVE)
    } catch {
      // fallback silencioso
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const handleArquivo = (file: File) => {
    if (TIPOS_ACEITOS.includes(file.type)) {
      selecionarArquivo(file)
    } else {
      selecionarArquivo(file) // deixa o domínio validar e retornar ARQUIVO_INVALIDO
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleArquivo(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleArquivo(file)
  }

  const handleNovaReserva = () => {
    resetar()
    navigate('/')
  }

  // Tela: janela expirada
  if (expirado || estado === 'janela-expirada') {
    return (
      <FlowLayout title="Tempo esgotado" showBack={false}>
        <div className="text-center py-12">
          <p className="text-6xl mb-4">⏰</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Reserva expirada</h2>
          <p className="text-gray-500 mb-8">
            A janela de 2 horas para envio do comprovante encerrou. O horário foi
            liberado automaticamente.
          </p>
          <button
            onClick={handleNovaReserva}
            className="w-full py-4 rounded-2xl font-bold text-white"
            style={{ background: '#1B4332' }}
          >
            Fazer nova reserva
          </button>
        </div>
      </FlowLayout>
    )
  }

  // Tela: reserva não encontrada
  if (estado === 'reserva-nao-encontrada') {
    return (
      <FlowLayout title="Erro" showBack={false}>
        <div className="text-center py-12">
          <p className="text-6xl mb-4">❌</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Reserva não encontrada</h2>
          <p className="text-gray-500 mb-8">Não foi possível localizar sua reserva.</p>
          <button
            onClick={handleNovaReserva}
            className="w-full py-4 rounded-2xl font-bold text-white"
            style={{ background: '#1B4332' }}
          >
            Fazer nova reserva
          </button>
        </div>
      </FlowLayout>
    )
  }

  return (
    <FlowLayout title="Enviar Comprovante">
      {/* Contador regressivo */}
      <div
        className={[
          'rounded-2xl p-4 mb-4 text-center border transition-colors',
          segundos < 600
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200',
        ].join(' ')}
      >
        <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${segundos < 600 ? 'text-red-500' : 'text-amber-600'}`}>
          Tempo restante para pagamento
        </p>
        <p className={`text-4xl font-mono font-bold tabular-nums ${segundos < 600 ? 'text-red-600' : 'text-amber-700'}`}>
          {formatarTempo(segundos)}
        </p>
      </div>

      {/* Resumo da reserva */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Sua reserva</p>
        <p className="font-bold text-gray-800">{slot.quadra_nome}</p>
        <p className="text-sm text-gray-600 mt-0.5">
          {formatarDataExibicao(slot.data)} · {slot.horario_inicio}h
        </p>
      </div>

      {/* Chave Pix */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
        <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wide mb-2">
          Chave Pix para pagamento
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-sm text-emerald-900 break-all">{PIX_CHAVE}</p>
          <button
            onClick={handleCopiarPix}
            className={[
              'shrink-0 text-xs border rounded-xl px-3 py-2 font-semibold transition-colors',
              copiado
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-emerald-400 text-emerald-700 hover:bg-emerald-100',
            ].join(' ')}
          >
            {copiado ? '✓ Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Área de upload */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          'border-2 border-dashed rounded-2xl p-6 text-center mb-4 transition-all',
          dragOver
            ? 'border-emerald-400 bg-emerald-50 scale-[1.01]'
            : 'border-gray-300 bg-white hover:border-gray-400',
        ].join(' ')}
      >
        {arquivoSelecionado ? (
          <div>
            <p className="text-3xl mb-2">📎</p>
            <p className="text-sm font-semibold text-gray-700">{arquivoSelecionado.name}</p>
            <p className="text-xs text-gray-400 mt-1">
              {(arquivoSelecionado.size / 1024).toFixed(0)} KB
            </p>
            <button
              onClick={() => selecionarArquivo(null)}
              className="mt-3 text-xs text-red-500 hover:text-red-700 underline"
            >
              Remover arquivo
            </button>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <p className="text-4xl mb-3">📤</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">
              Arraste o comprovante ou clique para selecionar
            </p>
            <p className="text-xs text-gray-400">JPG, PNG ou PDF · Máximo 10 MB</p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>
        )}
      </div>

      {estado === 'arquivo-invalido' && (
        <p className="text-sm text-red-600 text-center mb-3">
          ⚠️ Arquivo inválido. Use JPG, PNG ou PDF com menos de 10 MB.
        </p>
      )}

      <button
        onClick={() => reserva && enviar(reserva.id)}
        disabled={!arquivoSelecionado || estado === 'enviando'}
        className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all disabled:opacity-40 active:scale-95"
        style={{ background: '#1B4332' }}
      >
        {estado === 'enviando' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⟳</span> Enviando...
          </span>
        ) : (
          'Enviar comprovante'
        )}
      </button>
    </FlowLayout>
  )
}

// ─── Step 4 — Confirmação ─────────────────────────────────────────────────────

function ConfirmadaStep() {
  const navigate = useNavigate()
  const slot = useReservaStore(s => s.slotSelecionado)
  const cliente = useReservaStore(s => s.cliente)
  const resetar = useReservaStore(s => s.resetar)

  const handleNovaReserva = () => {
    resetar()
    navigate('/')
  }

  return (
    <div
      className="max-w-[480px] mx-auto min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#1B4332' }}
    >
      <div className="text-center text-white w-full">
        <div className="text-7xl mb-6 animate-bounce">🎾</div>
        <h1 className="text-3xl font-bold mb-2">Reserva confirmada!</h1>
        <p className="text-emerald-200 mb-8">
          Comprovante recebido. Até a quadra! 🏖️
        </p>

        {slot && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-8 text-left">
            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-3">
              Detalhes da reserva
            </p>
            {cliente?.nome && (
              <p className="text-white font-bold text-lg">{cliente.nome}</p>
            )}
            <p className="text-emerald-100 font-semibold">{slot.quadra_nome}</p>
            <p className="text-emerald-200 text-sm mt-1">
              {formatarDataExibicao(slot.data)} · {slot.horario_inicio}h–
              {String(parseInt(slot.horario_inicio) + 1).padStart(2, '0')}h
            </p>
          </div>
        )}

        <button
          onClick={handleNovaReserva}
          className="w-full py-4 rounded-2xl font-bold bg-white text-emerald-900 hover:bg-emerald-50 transition-colors text-base active:scale-95"
        >
          Fazer nova reserva
        </button>
      </div>
    </div>
  )
}

// ─── ReservaFlow — Router ─────────────────────────────────────────────────────

export default function ReservaFlow() {
  return (
    <Routes>
      <Route path="identificacao" element={<IdentificacaoStep />} />
      <Route path="contato" element={<ContatoStep />} />
      <Route path="comprovante" element={<ComprovanteStep />} />
      <Route path="confirmada" element={<ConfirmadaStep />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
