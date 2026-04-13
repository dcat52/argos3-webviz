import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FieldSchema } from '@/lib/vizEngine'

export interface VizConfig {
  colorBy: { enabled: boolean; field: string; scale: 'linear' | 'categorical'; colorA: string; colorB: string } | null
  links: { enabled: boolean; field: string; color: string; opacity: number } | null
  labels: { enabled: boolean; field: string }[]
  trails: { enabled: boolean; length: number; opacity: number }
  heatmap: { enabled: boolean; resolution: number; decay: number; colorA: string; colorB: string }
}

interface VizConfigStore {
  fields: FieldSchema[]
  config: VizConfig
  hintsApplied: boolean
  setFields: (fields: FieldSchema[]) => void
  setConfig: (patch: Partial<VizConfig>) => void
  applyHints: (hints: Record<string, unknown>) => void
}

const defaultConfig: VizConfig = {
  colorBy: null,
  links: null,
  labels: [],
  trails: { enabled: false, length: 50, opacity: 0.6 },
  heatmap: { enabled: false, resolution: 64, decay: 0.98, colorA: '#000000', colorB: '#ff4400' },
}

export const useVizConfigStore = create<VizConfigStore>()(
  persist(
    (set) => ({
      fields: [],
      config: defaultConfig,
      hintsApplied: false,
      setFields: (fields) => set({ fields }),
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      applyHints: (hints) =>
        set((s) => {
          if (s.hintsApplied) return s
          const patch: Partial<VizConfig> = {}
          if (hints.colorBy && typeof hints.colorBy === 'string')
            patch.colorBy = { enabled: true, field: hints.colorBy, scale: 'linear', colorA: '#0000ff', colorB: '#ff0000' }
          if (hints.links && typeof hints.links === 'string')
            patch.links = { enabled: true, field: hints.links, color: '#44aaff', opacity: 0.6 }
          return { config: { ...s.config, ...patch }, hintsApplied: true }
        }),
    }),
    { name: 'viz-config', partialize: (s) => ({ config: s.config }) }
  )
)
