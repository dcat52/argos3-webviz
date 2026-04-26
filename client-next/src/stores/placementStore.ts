import { create } from 'zustand'
import type { Vec3, Quaternion } from '@/types/protocol'

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

/** Yaw-only quaternion from angle in radians (rotation around Z axis) */
export function yawQuaternion(angle: number): Quaternion {
  const half = angle / 2
  return { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) }
}

/** Extract yaw angle (radians) from a Z-axis quaternion */
export function yawFromQuaternion(q: Quaternion): number {
  return 2 * Math.atan2(q.z, q.w)
}

const DRAG_THRESHOLD_PX = 8

interface PlacementState {
  active: boolean
  config: PlacementConfig | null
  cursorPos: Vec3 | null
  dragOrientation: Quaternion
  dragging: boolean
  previewPositions: Vec3[]
  previewOrientations: Quaternion[]
  previewType: string | null
  startPlacement: (config: PlacementConfig) => void
  updateCursor: (pos: Vec3) => void
  beginDrag: (pos: Vec3) => void
  updateDrag: (pos: Vec3) => void
  endDrag: () => { position: Vec3; orientation: Quaternion } | null
  setPreviewPositions: (positions: Vec3[], type?: string, orientations?: Quaternion[]) => void
  cancelPlacement: () => void
}

const IDENTITY_Q: Quaternion = { x: 0, y: 0, z: 0, w: 1 }
let dragStartScreen: { x: number; y: number } | null = null

export function setDragStartScreen(x: number, y: number) {
  dragStartScreen = { x, y }
}

export function isDragAboveThreshold(x: number, y: number): boolean {
  if (!dragStartScreen) return false
  const dx = x - dragStartScreen.x
  const dy = y - dragStartScreen.y
  return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX
}

export const usePlacementStore = create<PlacementState>((set, get) => ({
  active: false,
  config: null,
  cursorPos: null,
  dragOrientation: IDENTITY_Q,
  dragging: false,
  previewPositions: [],
  previewOrientations: [],
  previewType: null,

  startPlacement: (config) => set({ active: true, config, cursorPos: null, dragging: false, dragOrientation: IDENTITY_Q }),

  updateCursor: (pos) => {
    if (get().active) set({ cursorPos: pos })
  },

  beginDrag: (pos) => set({ cursorPos: pos, dragging: true, dragOrientation: IDENTITY_Q }),

  updateDrag: (pos) => {
    const { cursorPos } = get()
    if (!cursorPos) return
    const dx = pos.x - cursorPos.x
    const dy = pos.y - cursorPos.y
    if (dx * dx + dy * dy < 0.001) return
    set({ dragOrientation: yawQuaternion(Math.atan2(dy, dx)) })
  },

  endDrag: () => {
    const { cursorPos, dragOrientation, config } = get()
    if (!cursorPos || !config) { set({ dragging: false }); return null }
    const result = { position: { ...cursorPos }, orientation: { ...dragOrientation } }
    set({ dragging: false, dragOrientation: IDENTITY_Q })
    return result
  },

  setPreviewPositions: (positions, type, orientations) => set({ previewPositions: positions, previewType: type ?? null, previewOrientations: orientations ?? [] }),

  cancelPlacement: () => set({ active: false, config: null, cursorPos: null, previewPositions: [], previewOrientations: [], previewType: null, dragging: false, dragOrientation: IDENTITY_Q }),
}))
