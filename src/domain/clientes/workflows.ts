import type {
  RegistrarClienteInput,
  ClienteLocalizado,
  ClienteRegistrado,
  Resultado,
  Cliente,
} from '../types.js'
import { ok, erro } from '../types.js'
import { clienteRepo } from '../__repository__/index.js'
import { cpfValido, limparCpf, formatarCpf } from './cpf.js'
import { randomUUID } from '../__store__/uuid.js'

/**
 * RegistrarCliente
 *
 * - CPF já existe → ClienteLocalizado (sem alterar dados)
 * - CPF novo      → ClienteRegistrado (nome e telefone obrigatórios)
 * - CPF inválido  → CPF_INVALIDO
 *
 * Usa encontrarOuSalvar (atômico) para evitar duplo cadastro em concorrência.
 */
export async function registrarCliente(
  input: RegistrarClienteInput,
): Promise<Resultado<ClienteLocalizado | ClienteRegistrado>> {
  const digits = limparCpf(input.cpf)
  const cpfFormatado = digits.length === 11 ? formatarCpf(digits) : input.cpf

  if (!cpfValido(input.cpf)) {
    return erro({ code: 'CPF_INVALIDO', cpf: input.cpf })
  }

  // Para localizar um cliente existente, tentamos encontrarOuSalvar com campos vazios.
  // Se não tiver nome/telefone e o CPF for novo, retorna erro (MVP: campos obrigatórios).
  if (!input.nome || !input.telefone) {
    // Apenas lookup: verifica se o CPF já existe sem criar
    const existente = await clienteRepo.findByCpf(cpfFormatado)
    if (existente) {
      return ok<ClienteLocalizado>({ tipo: 'localizado', cliente: existente })
    }
    // CPF novo mas sem nome/telefone → erro (reutiliza CPF_INVALIDO por simplicidade de MVP)
    return erro({ code: 'CPF_INVALIDO', cpf: input.cpf })
  }

  const novoCliente: Cliente = {
    id: randomUUID(),
    cpf: cpfFormatado,
    nome: input.nome,
    telefone: input.telefone,
    criado_at: new Date().toISOString(),
  }

  // Atômico: cria se novo, localiza se já existe — previne double-insert em concorrência
  const { criado, cliente } = await clienteRepo.encontrarOuSalvar(novoCliente)

  if (!criado) {
    return ok<ClienteLocalizado>({ tipo: 'localizado', cliente })
  }
  return ok<ClienteRegistrado>({ tipo: 'registrado', cliente })
}
