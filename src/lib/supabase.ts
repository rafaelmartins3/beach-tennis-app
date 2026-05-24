import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase singleton.
 * Em testes (Vitest) este módulo é importado mas nunca utilizado —
 * os repositórios usam o store in-memory quando MODE === 'test'.
 * O fallback evita que createClient lance erro ao construir.
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key'

export const supabase = createClient(url, key)
