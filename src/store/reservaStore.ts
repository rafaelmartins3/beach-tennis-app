import { create } from 'zustand'
import type { Reserva, Cliente } from '@/domain/types'

export interface SlotSelecionado {
  quadra_id: number
  quadra_nome: string
  data: string          // YYYY-MM-DD
  horario_inicio: string // HH:MM
}

interface ReservaState {
  slotSelecionado: SlotSelecionado | null
  reserva: Reserva | null
  janelaExpiracao: string | null  // ISO string
  cliente: Cliente | null
  cpfPendente: string | null      // CPF de novo cliente aguardando dados de contato

  setSlotSelecionado: (slot: SlotSelecionado) => void
  setReserva: (reserva: Reserva, janelaExpiracao: string) => void
  setCliente: (cliente: Cliente) => void
  setCpfPendente: (cpf: string | null) => void
  resetar: () => void
}

export const useReservaStore = create<ReservaState>((set) => ({
  slotSelecionado: null,
  reserva: null,
  janelaExpiracao: null,
  cliente: null,
  cpfPendente: null,

  setSlotSelecionado: (slot) => set({ slotSelecionado: slot }),
  setReserva: (reserva, janelaExpiracao) => set({ reserva, janelaExpiracao }),
  setCliente: (cliente) => set({ cliente }),
  setCpfPendente: (cpf) => set({ cpfPendente: cpf }),
  resetar: () => set({
    slotSelecionado: null,
    reserva: null,
    janelaExpiracao: null,
    cliente: null,
    cpfPendente: null,
  }),
}))
