import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FieldSchema } from '@/lib/vizEngine'
import { VIZ_DEFAULTS } from '@/lib/defaults'
import { vizPresets } from '@/lib/vizPresets'
import { APP_MODE } from '@/lib/params'
import { memoryStorage } from '@/lib/memoryStorage'

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
  loadPreset: (config: VizConfig) => void
  exportConfig: () => string
  importConfig: (json: string) => void
}

const defaultConfig: VizConfig = {
  colorBy: null,
  links: null,
  labels: [],
  trails: { enabled: false, length: VIZ_DEFAULTS.trailLength, opacity: VIZ_DEFAULTS.trailOpacity },
  heatmap: { enabled: false, resolution: VIZ_DEFAULTS.heatmapResolution, decay: VIZ_DEFAULTS.heatmapDecay, colorA: VIZ_DEFAULTS.heatmapColorA, colorB: VIZ_DEFAULTS.heatmapColorB },
}

export const useVizConfigStore = create<VizConfigStore>()(
  persist(
    (set, get) => ({
      fields: [],
      config: defaultConfig,
      hintsApplied: false,
      setFields: (fields) => set({ fields }),
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      loadPreset: (config) => set({ config }),
      exportConfig: () => {
        const { config } = get()
        return JSON.stringify({ version: 1, ...config }, null, 2)
      },
      importConfig: (json) => {
        try {
          const parsed = JSON.parse(json)
          const { version, ...config } = parsed
          set({ config: { ...defaultConfig, ...config } })
        } catch { /* ignore invalid JSON */ }
      },
      applyHints: (hints) =>
        set((s) => {
          if (s.hintsApplied) return s
          // If preset specified, load it
          if (hints.preset && typeof hints.preset === 'string') {
            const preset = vizPresets.find(p => p.id === hints.preset)
            if (preset) return { config: preset.config, hintsApplied: true }
          }
          const patch: Partial<VizConfig> = {}
          if (hints.colorBy && typeof hints.colorBy === 'string')
            patch.colorBy = { enabled: true, field: hints.colorBy, scale: 'linear', colorA: '#0000ff', colorB: '#ff0000' }
          if (hints.links && typeof hints.links === 'string')
            patch.links = { enabled: true, field: hints.links, color: '#44aaff', opacity: 0.6 }
          return { config: { ...s.config, ...patch }, hintsApplied: true }
        }),
    }),
    { name: 'viz-config', partialize: (s) => ({ config: s.config }), storage: createJSONStorage(() => APP_MODE === 'viewer' ? memoryStorage : localStorage) }
  )
)
