import { storeClientes } from '../__store__/index.js'

export async function limparClientes(): Promise<void> {
  storeClientes.clear()
}
