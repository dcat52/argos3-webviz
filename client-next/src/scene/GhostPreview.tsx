import { usePlacementStore } from '@/stores/placementStore'
import { EntityRenderer } from '@/entities/EntityRenderer'
import type { AnyEntity } from '@/types/protocol'

function makeGhost(type: string, id: string, position: { x: number; y: number; z: number }, config?: any): AnyEntity {
  return {
    type,
    id,
    position,
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    ...(type === 'box' ? { scale: config?.size ?? { x: 0.3, y: 0.3, z: 0.3 }, is_movable: true } : {}),
    ...(type === 'cylinder' ? { radius: config?.radius ?? 0.15, height: config?.height ?? 0.5, is_movable: true } : {}),
    ...((type === 'foot-bot' || type === 'kheperaiv') ? { leds: [], rays: [], points: [] } : {}),
  } as AnyEntity
}

export function GhostPreview() {
  const { active, config, cursorPos, previewPositions, previewType } = usePlacementStore()

  return (
    <>
      {/* Single ghost at cursor for click-to-place */}
      {active && config && cursorPos && (
        <EntityRenderer entity={makeGhost(config.type, '__ghost_cursor', cursorPos, config)} ghost />
      )}

      {/* Multiple ghosts for distribute preview */}
      {previewType && previewPositions.map((pos, i) => (
        <EntityRenderer key={i} entity={makeGhost(previewType, `__ghost_dist_${i}`, pos)} ghost />
      ))}
    </>
  )
}
