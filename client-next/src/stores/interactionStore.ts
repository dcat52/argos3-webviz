import { create } from 'zustand'

export type InteractionMode = 'select' | 'place' | 'distribute'

interface InteractionState {
  mode: InteractionMode
  setMode: (mode: InteractionMode) => void
}

export const useInteractionStore = create<InteractionState>((set) => ({
  mode: 'select',
  setMode: (mode) => set({ mode }),
}))
