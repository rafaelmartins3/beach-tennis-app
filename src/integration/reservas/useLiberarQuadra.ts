/**
 * useLiberarQuadra
 *
 * Conecta o ContadorRegressivo ao workflow LiberarQuadra.
 * Executado automaticamente quando a janela de 2h expira no cliente.
 *
 * Mapeamentos (api-contract-liberar-quadra.json):
 *   JanelaDePagamentoExpirada → estado 'janela-expirada' (tela cliente)
 *   QuadraLiberada            → estado 'disponivel' (grade atualizada)
 *   ReservaNãoEncontrada      → estado 'reserva-nao-encontrada'
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { liberarQuadra, expirarReservasVencidas } from '@/domain/reservas/workflows'

export type EstadoExpiracao =
  | 'aguardando'          // janela ainda ativa
  | 'janela-expirada'     // JanelaDePagamentoExpirada — tela de aviso ao cliente
  | 'disponivel'          // QuadraLiberada — grade volta ao estado livre
  | 'reserva-nao-encontrada'

interface UseLiberarQuadraResult {
  estado: EstadoExpiracao
  segundosRestantes: number
  executarExpiracao: (reserva_id: string) => Promise<void>
}

export function useLiberarQuadra(
  janelaExpiracao: Date | null,
  reserva_id: string | null,
): UseLiberarQuadraResult {
  const [estado, setEstado] = useState<EstadoExpiracao>('aguardando')
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const executouRef = useRef(false)

  // Countdown tick
  useEffect(() => {
    if (!janelaExpiracao) return

    const tick = () => {
      const diff = Math.max(0, Math.floor((janelaExpiracao.getTime() - Date.now()) / 1000))
      setSegundosRestantes(diff)
      return diff
    }

    tick()
    const interval = setInterval(() => {
      const restante = tick()
      if (restante === 0 && !executouRef.current) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [janelaExpiracao])

  // Dispara expiração quando o contador chega a zero
  useEffect(() => {
    if (segundosRestantes === 0 && reserva_id && !executouRef.current && janelaExpiracao) {
      executouRef.current = true
      executarExpiracao(reserva_id)
    }
  }, [segundosRestantes, reserva_id, janelaExpiracao])

  const executarExpiracao = useCallback(async (id: string) => {
    try {
      const result = await liberarQuadra({ reserva_id: id })

      if (!result.ok) {
        const errorMap: Record<string, EstadoExpiracao> = {
          RESERVA_NAO_ENCONTRADA: 'reserva-nao-encontrada',
        }
        setEstado(errorMap[result.erro.code] ?? 'janela-expirada')
        return
      }

      setEstado('janela-expirada')
      // Após breve delay, a grade pode ser atualizada externamente
      setTimeout(() => setEstado('disponivel'), 1500)
    } catch {
      setEstado('janela-expirada')
    }
  }, [])

  return { estado, segundosRestantes, executarExpiracao }
}

/**
 * Hook para o job de expiração em lote — usado no painel admin
 * para atualizar automaticamente a lista sem reload manual.
 */
export function useExpiracaoAutomatica(intervalMs = 60_000) {
  const executar = useCallback(async () => {
    try {
      await expirarReservasVencidas()
    } catch {
      // silencioso — job de background
    }
  }, [])

  useEffect(() => {
    executar() // roda imediatamente
    const id = setInterval(executar, intervalMs)
    return () => clearInterval(id)
  }, [executar, intervalMs])
}
