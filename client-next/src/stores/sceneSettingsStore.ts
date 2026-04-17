import { create } from 'zustand'
import type { EnvPreset } from '../scene/EnvironmentPreset'

interface SceneSettingsState {
  envPreset: EnvPreset
  setEnvPreset: (p: EnvPreset) => void
  showFps: boolean
  toggleFps: () => void
}

export const useSceneSettingsStore = create<SceneSettingsState>((set) => ({
  envPreset: 'grid',
  setEnvPreset: (envPreset) => set({ envPreset }),
  showFps: false,
  toggleFps: () => set((s) => ({ showFps: !s.showFps })),
}))
