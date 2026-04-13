import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  wsUrl: string
  shadows: boolean
  pixelRatio: number
  setWsUrl: (url: string) => void
  setShadows: (v: boolean) => void
  setPixelRatio: (v: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      wsUrl: `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000`,
      shadows: true,
      pixelRatio: 1,
      setWsUrl: (wsUrl) => set({ wsUrl }),
      setShadows: (shadows) => set({ shadows }),
      setPixelRatio: (pixelRatio) => set({ pixelRatio }),
    }),
    { name: 'argos-settings' }
  )
)
