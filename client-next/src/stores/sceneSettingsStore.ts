import { create } from 'zustand'
import type { EnvPreset } from '../scene/EnvironmentPreset'

interface SceneSettingsState {
  envPreset: EnvPreset
  setEnvPreset: (p: EnvPreset) => void
}

export const useSceneSettingsStore = create<SceneSettingsState>((set) => ({
  envPreset: 'grid',
  setEnvPreset: (envPreset) => set({ envPreset }),
}))
