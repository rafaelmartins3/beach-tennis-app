/**
 * Exporta os repositórios corretos conforme o ambiente:
 *   MODE === 'test'  → in-memory (Vitest, sem rede, isolado)
 *   MODE !== 'test'  → Supabase (produção / desenvolvimento)
 *
 * O Vite/Vitest substitui import.meta.env.MODE em build-time,
 * permitindo tree-shaking do módulo não utilizado em produção.
 */

import {
  memoryReservaRepo,
  memoryClienteRepo,
  memoryArquivoRepo,
} from './memory.js'

import {
  supabaseReservaRepo,
  supabaseClienteRepo,
  supabaseArquivoRepo,
} from './supabase.js'

const isTest = import.meta.env.MODE === 'test'

export const reservaRepo = isTest ? memoryReservaRepo : supabaseReservaRepo
export const clienteRepo = isTest ? memoryClienteRepo : supabaseClienteRepo
export const arquivoRepo = isTest ? memoryArquivoRepo : supabaseArquivoRepo
