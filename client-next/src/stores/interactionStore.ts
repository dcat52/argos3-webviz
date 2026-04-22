import { create } from 'zustand'

export type InteractionMode = 'select' | 'place' | 'distribute'

interface InteractionState {
  mode: InteractionMode
  editing: boolean
  setMode: (mode: InteractionMode) => void
  enterEditing: () => void
  exitEditing: () => void
}

export const useInteractionStore = create<InteractionState>((set) => ({
  mode: 'select',
  editing: false,
  setMode: (mode) => set({ mode, editing: true }),
  enterEditing: () => set({ editing: true }),
  exitEditing: () => set({ editing: false, mode: 'select' }),
}))
