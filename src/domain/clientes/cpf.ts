/**
 * Validação e normalização de CPF brasileiro.
 */

/** Remove tudo que não é dígito */
export function limparCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/** Formata 11 dígitos → "000.000.000-00" */
export function formatarCpf(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

/** Valida CPF (formato + dígitos verificadores) */
export function cpfValido(cpf: string): boolean {
  const digits = limparCpf(cpf)

  if (digits.length !== 11) return false

  // Sequências inválidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Dígito verificador 1
  const d1 = calcDigito(digits, 10)
  if (d1 !== Number(digits[9])) return false

  // Dígito verificador 2
  const d2 = calcDigito(digits, 11)
  if (d2 !== Number(digits[10])) return false

  return true
}

function calcDigito(digits: string, peso: number): number {
  let soma = 0
  for (let i = 0; i < peso - 1; i++) {
    soma += Number(digits[i]) * (peso - i)
  }
  const resto = (soma * 10) % 11
  return resto === 10 || resto === 11 ? 0 : resto
}
