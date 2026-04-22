import { create } from 'zustand'
import type { Vec3 } from '@/types/protocol'

export interface PlacementConfig {
  type: string
  controller?: string
  size?: Vec3
  movable?: boolean
  mass?: number
  radius?: number
  height?: number
  id_prefix?: string
}

interface PlacementState {
  active: boolean
  config: PlacementConfig | null
  cursorPos: Vec3 | null
  startPlacement: (config: PlacementConfig) => void
  updateCursor: (pos: Vec3) => void
  cancelPlacement: () => void
  confirmPlacement: () => Vec3 | null
}

export const usePlacementStore = create<PlacementState>((set, get) => ({
  active: false,
  config: null,
  cursorPos: null,

  startPlacement: (config) => set({ active: true, config, cursorPos: null }),

  updateCursor: (pos) => {
    if (get().active) set({ cursorPos: pos })
  },

  cancelPlacement: () => set({ active: false, config: null, cursorPos: null }),

  confirmPlacement: () => {
    const { cursorPos, config } = get()
    set({ active: false, config: null, cursorPos: null })
    return cursorPos
  },
}))
