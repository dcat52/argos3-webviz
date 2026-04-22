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
  previewPositions: Vec3[]
  previewType: string | null
  startPlacement: (config: PlacementConfig) => void
  updateCursor: (pos: Vec3) => void
  setPreviewPositions: (positions: Vec3[], type?: string) => void
  cancelPlacement: () => void
  confirmPlacement: () => Vec3 | null
}

export const usePlacementStore = create<PlacementState>((set, get) => ({
  active: false,
  config: null,
  cursorPos: null,
  previewPositions: [],
  previewType: null,

  startPlacement: (config) => set({ active: true, config, cursorPos: null }),

  updateCursor: (pos) => {
    if (get().active) set({ cursorPos: pos })
  },

  setPreviewPositions: (positions, type) => set({ previewPositions: positions, previewType: type ?? null }),

  cancelPlacement: () => set({ active: false, config: null, cursorPos: null, previewPositions: [], previewType: null }),

  confirmPlacement: () => {
    const { cursorPos, config } = get()
    set({ active: false, config: null, cursorPos: null })
    return cursorPos
  },
}))
