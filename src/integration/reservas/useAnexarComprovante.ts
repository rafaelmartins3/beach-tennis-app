/**
 * useAnexarComprovante
 *
 * Conecta ÁreaDeUpload + BotãoEnviar ao workflow AnexarComprovante
 * do bounded context Reservas.
 *
 * Mapeamentos (api-contract-anexar-comprovante.json):
 *   ComprovanteAnexado   → estado 'enviando'
 *   ReservaConfirmada    → estado 'reserva-confirmada'
 *   ReservaNãoEncontrada → estado 'reserva-nao-encontrada'
 *   JanelaExpirada       → estado 'janela-expirada'
 *   ArquivoInválido      → estado 'arquivo-invalido'
 *   ReservaJáConfirmada  → estado 'reserva-nao-encontrada' (mapeado por similaridade no MVP)
 */

import { useState, useCallback } from 'react'
import { anexarComprovante } from '@/domain/reservas/workflows'
import type { Reserva } from '@/domain/types'

export type EstadoComprovante =
  | 'aguardando-upload'      // ContadorRegressivo ativo, ÁreaDeUpload vazia
  | 'arquivo-selecionado'    // arquivo escolhido, botão habilitado (estado auxiliar)
  | 'enviando'               // AnexarComprovante em progresso
  | 'reserva-confirmada'     // ReservaConfirmada — sucesso
  | 'janela-expirada'        // JanelaExpirada
  | 'arquivo-invalido'       // ArquivoInválido
  | 'reserva-nao-encontrada' // ReservaNãoEncontrada ou ReservaJáConfirmada
  | 'erro-conexao'

interface UseAnexarComprovanteResult {
  estado: EstadoComprovante
  reservaConfirmada: Reserva | null
  arquivoSelecionado: File | null
  selecionarArquivo: (arquivo: File | null) => void
  enviar: (reserva_id: string) => Promise<void>
  resetar: () => void
}

export function useAnexarComprovante(): UseAnexarComprovanteResult {
  const [estado, setEstado] = useState<EstadoComprovante>('aguardando-upload')
  const [reservaConfirmada, setReservaConfirmada] = useState<Reserva | null>(null)
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)

  const selecionarArquivo = useCallback((arquivo: File | null) => {
    setArquivoSelecionado(arquivo)
    setEstado(arquivo ? 'arquivo-selecionado' : 'aguardando-upload')
  }, [])

  const enviar = useCallback(async (reserva_id: string) => {
    if (!arquivoSelecionado) return

    setEstado('enviando')

    try {
      const result = await anexarComprovante({ reserva_id, arquivo: arquivoSelecionado })

      if (!result.ok) {
        const errorMap: Record<string, EstadoComprovante> = {
          JANELA_EXPIRADA:        'janela-expirada',
          ARQUIVO_INVALIDO:       'arquivo-invalido',
          RESERVA_NAO_ENCONTRADA: 'reserva-nao-encontrada',
          RESERVA_JA_CONFIRMADA:  'reserva-nao-encontrada',
        }
        setEstado(errorMap[result.erro.code] ?? 'erro-conexao')
        return
      }

      setReservaConfirmada(result.data.reserva)
      setEstado('reserva-confirmada')
    } catch {
      setEstado('erro-conexao')
    }
  }, [arquivoSelecionado])

  const resetar = useCallback(() => {
    setEstado('aguardando-upload')
    setReservaConfirmada(null)
    setArquivoSelecionado(null)
  }, [])

  return { estado, reservaConfirmada, arquivoSelecionado, selecionarArquivo, enviar, resetar }
}
