import { usePlacementStore } from '@/stores/placementStore'
import { EntityRenderer } from '@/entities/EntityRenderer'
import type { AnyEntity } from '@/types/protocol'

/** Renders a transparent ghost entity at the cursor position during placement mode */
export function GhostPreview() {
  const { active, config, cursorPos } = usePlacementStore()

  if (!active || !config || !cursorPos) return null

  // Build a fake entity for the renderer
  const ghost: AnyEntity = {
    type: config.type,
    id: '__ghost_preview',
    position: cursorPos,
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    // Box-specific
    ...(config.type === 'box' ? {
      scale: config.size ?? { x: 0.3, y: 0.3, z: 0.3 },
      is_movable: true,
    } : {}),
    // Cylinder-specific
    ...(config.type === 'cylinder' ? {
      radius: config.radius ?? 0.15,
      height: config.height ?? 0.5,
      is_movable: true,
    } : {}),
    // Robot-specific
    ...((config.type === 'foot-bot' || config.type === 'kheperaiv') ? {
      leds: [],
      rays: [],
      points: [],
    } : {}),
  } as AnyEntity

  return (
    <EntityRenderer
      entity={ghost}
      ghost
    />
  )
}
