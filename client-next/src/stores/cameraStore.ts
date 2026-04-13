import { create } from 'zustand'

export type CameraPreset = 'isometric' | 'top' | 'side' | 'follow'

interface CameraState {
  preset: CameraPreset
  setPreset: (p: CameraPreset) => void
  flyToTarget: [number, number, number] | null
  flyTo: (target: [number, number, number]) => void
  clearFlyTo: () => void
}

export const useCameraStore = create<CameraState>((set) => ({
  preset: 'isometric',
  setPreset: (preset) => set({ preset }),
  flyToTarget: null,
  flyTo: (target) => set({ flyToTarget: target }),
  clearFlyTo: () => set({ flyToTarget: null }),
}))
