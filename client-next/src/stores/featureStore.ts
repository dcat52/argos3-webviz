import { create } from 'zustand'

export interface FeatureDef {
  id: string
  label: string
  description?: string
  experimental: boolean
}

interface FeatureState {
  features: Map<string, FeatureDef>
  enabled: Map<string, boolean>
  experimentalEnabled: boolean
  toggleFeature: (id: string) => void
  setExperimentalEnabled: (on: boolean) => void
}

const STORAGE_KEY = 'webviz-features'

function loadSaved(): { overrides: Record<string, boolean>; experimentalEnabled: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { overrides: {}, experimentalEnabled: true }
    const parsed = JSON.parse(raw)
    // Support old format (flat object) and new format
    if ('experimentalEnabled' in parsed) return parsed
    return { overrides: parsed, experimentalEnabled: true }
  } catch { return { overrides: {}, experimentalEnabled: true } }
}

function persist(enabled: Map<string, boolean>, experimentalEnabled: boolean) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ overrides: Object.fromEntries(enabled), experimentalEnabled }))
}

export const useFeatureStore = create<FeatureState>((set, get) => ({
  features: new Map(),
  enabled: new Map(),
  experimentalEnabled: true,
  toggleFeature: (id) => {
    const enabled = new Map(get().enabled)
    enabled.set(id, !enabled.get(id))
    persist(enabled, get().experimentalEnabled)
    set({ enabled })
  },
  setExperimentalEnabled: (on) => {
    const { features, enabled: current } = get()
    const enabled = new Map(current)
    for (const [id, def] of features) {
      if (def.experimental) enabled.set(id, on)
    }
    persist(enabled, on)
    set({ enabled, experimentalEnabled: on })
  },
}))

const saved = loadSaved()

/** Register a feature. Call at module scope. */
export function registerFeature(def: FeatureDef) {
  const store = useFeatureStore.getState()
  const features = new Map(store.features)
  const enabled = new Map(store.enabled)
  features.set(def.id, def)
  // Saved override > master toggle > default (experimental defaults ON when master is ON)
  if (def.id in saved.overrides) {
    enabled.set(def.id, saved.overrides[def.id])
  } else {
    enabled.set(def.id, def.experimental ? saved.experimentalEnabled : true)
  }
  useFeatureStore.setState({ features, enabled, experimentalEnabled: saved.experimentalEnabled })
}

/** Hook: is feature enabled? */
export function useFeature(id: string): boolean {
  return useFeatureStore((s) => s.enabled.get(id) ?? false)
}
