import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { COLORS, CAMERA, LIMITS, RECORDING, CONNECTION, LIGHTING, SPEED_OPTIONS } from '@/lib/defaults'
import { APP_MODE } from '@/lib/params'
import { memoryStorage } from '@/lib/memoryStorage'

interface SpeedOption { value: number; label: string }

export type RenderTier = 1 | 2 | 3

interface SettingsState {
  // Connection
  wsUrl: string
  reconnectIntervalMs: number
  // Speed
  speedOptions: SpeedOption[]
  // Rendering
  shadows: boolean
  pixelRatio: number
  fov: number
  orthographic: boolean
  renderTier: RenderTier
  // Camera
  cameraMinDistance: number
  cameraMaxDistanceMultiplier: number
  cameraSmoothTime: number
  // Colors
  selectionColor: string
  selectionOpacity: number
  rayHitColor: string
  rayMissColor: string
  trailColor: string
  // Lighting
  directionalIntensity: number
  hemisphereIntensity: number
  // Limits
  maxLogEntries: number
  maxEventLogEntries: number
  // Recording
  captureFps: number
  videoBitrate: number
  // Actions
  set: (patch: Partial<Omit<SettingsState, 'set' | 'reset'>>) => void
  reset: () => void
}

const defaults = {
  wsUrl: `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${CONNECTION.defaultPort}`,
  reconnectIntervalMs: CONNECTION.reconnectIntervalMs,
  speedOptions: [...SPEED_OPTIONS],
  shadows: true,
  pixelRatio: 1,
  fov: CAMERA.fov,
  orthographic: false,
  renderTier: 2 as RenderTier,
  cameraMinDistance: CAMERA.minDistance,
  cameraMaxDistanceMultiplier: CAMERA.maxDistanceMultiplier,
  cameraSmoothTime: CAMERA.smoothTime,
  selectionColor: COLORS.selection,
  selectionOpacity: COLORS.selectionOpacity,
  rayHitColor: COLORS.rayHit,
  rayMissColor: COLORS.rayMiss,
  trailColor: COLORS.trail,
  directionalIntensity: LIGHTING.directionalIntensity,
  hemisphereIntensity: LIGHTING.hemisphereIntensity,
  maxLogEntries: LIMITS.maxLogEntries,
  maxEventLogEntries: LIMITS.maxEventLogEntries,
  captureFps: RECORDING.captureFps,
  videoBitrate: RECORDING.videoBitrate,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (patch) => set(patch),
      reset: () => set(defaults),
    }),
    { name: 'argos-settings', storage: createJSONStorage(() => APP_MODE === 'viewer' ? memoryStorage : localStorage) }
  )
)
