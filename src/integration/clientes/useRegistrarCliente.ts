/**
 * useRegistrarCliente
 *
 * Conecta CampoCPF + BotãoContinuar ao workflow RegistrarCliente
 * do bounded context Clientes.
 *
 * Mapeamentos (api-contract-registrar-cliente.json):
 *   ClienteLocalizado → estado 'cpf-valido' (cliente existente, pula tela de contato)
 *   ClienteRegistrado → estado 'cpf-valido' (novo cliente, exibe tela de contato)
 *   CPFInválido       → estado 'cpf-invalido'
 */

import { useState, useCallback } from 'react'
import { registrarCliente } from '@/domain/clientes/workflows'
import type { Cliente } from '@/domain/types'

export type EstadoIdentificacao =
  | 'aguardando-cpf'    // formulário vazio
  | 'carregando'        // processando
  | 'cpf-valido'        // ClienteLocalizado ou ClienteRegistrado
  | 'cpf-invalido'      // CPFInválido
  | 'erro-conexao'

interface DadosContato {
  nome: string
  telefone: string
}

interface UseRegistrarClienteResult {
  estado: EstadoIdentificacao
  cliente: Cliente | null
  precisaDadosContato: boolean   // true = ClienteRegistrado (novo), false = ClienteLocalizado
  identificar: (cpf: string) => Promise<void>
  completarCadastro: (cpf: string, dados: DadosContato) => Promise<void>
  resetar: () => void
}

export function useRegistrarCliente(): UseRegistrarClienteResult {
  const [estado, setEstado] = useState<EstadoIdentificacao>('aguardando-cpf')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [precisaDadosContato, setPrecisaDadosContato] = useState(false)

  // Etapa 1: verifica se CPF existe
  const identificar = useCallback(async (cpf: string) => {
    setEstado('carregando')
    try {
      const result = await registrarCliente({ cpf })

      if (!result.ok) {
        const errorMap: Record<string, EstadoIdentificacao> = {
          CPF_INVALIDO: 'cpf-invalido',
        }
        setEstado(errorMap[result.erro.code] ?? 'cpf-invalido')
        return
      }

      setCliente(result.data.cliente)
      setPrecisaDadosContato(result.data.tipo === 'registrado')
      // 'registrado' sem nome/tel = precisaDadosContato true (tela 3)
      // 'localizado' = vai direto para comprovante
      setEstado('cpf-valido')
    } catch {
      setEstado('erro-conexao')
    }
  }, [])

  // Etapa 2 (apenas clientes novos): completa cadastro com nome e telefone
  const completarCadastro = useCallback(async (cpf: string, dados: DadosContato) => {
    setEstado('carregando')
    try {
      const result = await registrarCliente({ cpf, nome: dados.nome, telefone: dados.telefone })

      if (!result.ok) {
        setEstado('cpf-invalido')
        return
      }

      setCliente(result.data.cliente)
      setPrecisaDadosContato(false)
      setEstado('cpf-valido')
    } catch {
      setEstado('erro-conexao')
    }
  }, [])

  const resetar = useCallback(() => {
    setEstado('aguardando-cpf')
    setCliente(null)
    setPrecisaDadosContato(false)
  }, [])

  return { estado, cliente, precisaDadosContato, identificar, completarCadastro, resetar }
}
