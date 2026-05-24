/**
 * useConsultarDisponibilidade
 *
 * Conecta o componente SeletorDeData + GradeDeHorários ao workflow
 * ConsultarDisponibilidade do bounded context Agenda.
 *
 * Mapeamentos (api-contract-consultar-disponibilidade.json):
 *   DisponibilidadeConsultada → estado 'disponivel' nos slots
 *   HorárioForaDeOperação    → estado 'fora_operacao' nos slots
 */

import { useState, useEffect, useCallback } from 'react'
import { consultarDisponibilidade } from '@/domain/agenda/workflows'
import type { SlotDisponibilidade } from '@/domain/types'

export type EstadoAgenda =
  | 'carregando'
  | 'disponivel'      // DisponibilidadeConsultada — grade pronta
  | 'fora_operacao'   // HorárioForaDeOperação — dia sem slots (ex: domingo)
  | 'erro-conexao'    // falha de rede

interface UseConsultarDisponibilidadeResult {
  estado: EstadoAgenda
  slots: SlotDisponibilidade[]
  data: string
  setData: (data: string) => void
  recarregar: () => void
}

export function useConsultarDisponibilidade(dataInicial: string): UseConsultarDisponibilidadeResult {
  const [data, setData] = useState(dataInicial)
  const [estado, setEstado] = useState<EstadoAgenda>('carregando')
  const [slots, setSlots] = useState<SlotDisponibilidade[]>([])

  const carregar = useCallback(async (d: string) => {
    setEstado('carregando')
    setSlots([])

    try {
      const result = await consultarDisponibilidade({ data: d })

      if (!result.ok) {
        setEstado('fora_operacao')
        return
      }

      const { slots: novosSlots } = result.data
      const temDisponivel = novosSlots.some(s => s.status === 'disponivel')

      setSlots(novosSlots)
      setEstado(temDisponivel ? 'disponivel' : 'fora_operacao')
    } catch {
      setEstado('erro-conexao')
    }
  }, [])

  useEffect(() => {
    carregar(data)
  }, [data, carregar])

  const handleSetData = useCallback((novaData: string) => {
    setData(novaData)
  }, [])

  return {
    estado,
    slots,
    data,
    setData: handleSetData,
    recarregar: () => carregar(data),
  }
}
