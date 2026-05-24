/**
 * useIniciarReserva
 *
 * Conecta GradeDeHorários (clique em slot disponível) ao workflow
 * IniciarReserva do bounded context Reservas.
 *
 * Mapeamentos (api-contract-iniciar-reserva.json):
 *   ReservaIniciada       → estado 'bloqueado' (slot fica amarelo)
 *   QuadraNãoDisponível   → estado 'bloqueado' (slot já tomado — recarrega grade)
 *   HorárioForaDeOperação → estado 'fora_operacao' (não deveria chegar aqui, mas tratado)
 */

import { useState, useCallback } from 'react'
import { iniciarReserva } from '@/domain/reservas/workflows'
import type { Reserva, IniciarReservaInput } from '@/domain/types'

export type EstadoReserva =
  | 'idle'
  | 'carregando'
  | 'bloqueado'            // ReservaIniciada — aguardando pagamento
  | 'quadra-indisponivel'  // QuadraNãoDisponível
  | 'fora-operacao'        // HorárioForaDeOperação
  | 'erro-conexao'

interface UseIniciarReservaResult {
  estado: EstadoReserva
  reserva: Reserva | null
  janelaExpiracao: Date | null
  iniciar: (input: IniciarReservaInput) => Promise<void>
  resetar: () => void
}

export function useIniciarReserva(): UseIniciarReservaResult {
  const [estado, setEstado] = useState<EstadoReserva>('idle')
  const [reserva, setReserva] = useState<Reserva | null>(null)
  const [janelaExpiracao, setJanelaExpiracao] = useState<Date | null>(null)

  const iniciar = useCallback(async (input: IniciarReservaInput) => {
    setEstado('carregando')

    try {
      const result = await iniciarReserva(input)

      if (!result.ok) {
        const errorMap: Record<string, EstadoReserva> = {
          QUADRA_NAO_DISPONIVEL: 'quadra-indisponivel',
          HORARIO_FORA_DE_OPERACAO: 'fora-operacao',
        }
        setEstado(errorMap[result.erro.code] ?? 'erro-conexao')
        return
      }

      setReserva(result.data.reserva)
      setJanelaExpiracao(new Date(result.data.janela_expiracao_at))
      setEstado('bloqueado')
    } catch {
      setEstado('erro-conexao')
    }
  }, [])

  const resetar = useCallback(() => {
    setEstado('idle')
    setReserva(null)
    setJanelaExpiracao(null)
  }, [])

  return { estado, reserva, janelaExpiracao, iniciar, resetar }
}
