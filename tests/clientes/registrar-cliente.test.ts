import { describe, it, expect, beforeEach } from 'vitest'
import { registrarCliente } from '@/domain/clientes/workflows'
import { limparClientes } from '@/domain/clientes/test-helpers'

describe('RegistrarCliente', () => {

  beforeEach(async () => {
    await limparClientes()
  })

  // ── Caminho feliz ──────────────────────────────────────────────────────────

  it('CPF novo — cria cliente e retorna ClienteRegistrado', async () => {
    const result = await registrarCliente({
      cpf: '529.982.247-25',
      nome: 'Rafael Martins',
      telefone: '(11) 99999-8888',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.tipo).toBe('registrado')
    expect(result.data.cliente.cpf).toBe('529.982.247-25')
    expect(result.data.cliente.nome).toBe('Rafael Martins')
    expect(result.data.cliente.id).toBeTruthy()
  })

  it('CPF existente — localiza cliente e retorna ClienteLocalizado sem alterar dados', async () => {
    // primeira chamada: registra
    await registrarCliente({ cpf: '529.982.247-25', nome: 'Rafael Martins', telefone: '(11) 99999-8888' })
    // segunda chamada: localiza
    const result = await registrarCliente({ cpf: '529.982.247-25' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.tipo).toBe('localizado')
    expect(result.data.cliente.nome).toBe('Rafael Martins') // nome não foi alterado
  })

  it('CPF sem pontuação é aceito e normalizado', async () => {
    const result = await registrarCliente({
      cpf: '52998224725',
      nome: 'Carlos Teste',
      telefone: '(11) 98888-7777',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.cliente.cpf).toBe('529.982.247-25')
  })

  // ── Falhas de domínio ──────────────────────────────────────────────────────

  it('CPF_INVALIDO — todos os dígitos iguais (111.111.111-11)', async () => {
    const result = await registrarCliente({
      cpf: '111.111.111-11',
      nome: 'Teste',
      telefone: '(11) 99999-0000',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('CPF_INVALIDO')
  })

  it('CPF_INVALIDO — dígito verificador errado', async () => {
    const result = await registrarCliente({
      cpf: '529.982.247-00', // dígitos verificadores errados
      nome: 'Teste',
      telefone: '(11) 99999-0000',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('CPF_INVALIDO')
  })

  it('CPF_INVALIDO — formato completamente inválido', async () => {
    const result = await registrarCliente({
      cpf: 'abc.def.ghi-jk',
      nome: 'Teste',
      telefone: '(11) 99999-0000',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('CPF_INVALIDO')
  })

  it('CPF_INVALIDO — menos de 11 dígitos', async () => {
    const result = await registrarCliente({
      cpf: '123.456.789',
      nome: 'Teste',
      telefone: '(11) 99999-0000',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.erro.code).toBe('CPF_INVALIDO')
  })

  it('campo obrigatório ausente — CPF novo sem nome retorna erro', async () => {
    const result = await registrarCliente({
      cpf: '529.982.247-25',
      // nome ausente intencionalmente
      telefone: '(11) 99999-8888',
    })
    expect(result.ok).toBe(false)
  })

  // ── Concorrência ──────────────────────────────────────────────────────────

  it('concorrência — mesmo CPF cadastrado simultaneamente — apenas um ClienteRegistrado', async () => {
    const [r1, r2] = await Promise.all([
      registrarCliente({ cpf: '529.982.247-25', nome: 'Rafael', telefone: '(11) 99999-0001' }),
      registrarCliente({ cpf: '529.982.247-25', nome: 'Rafael', telefone: '(11) 99999-0001' }),
    ])
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    const tipos = [r1.data.tipo, r2.data.tipo]
    expect(tipos).toContain('registrado')
    expect(tipos).toContain('localizado')
  })

})
