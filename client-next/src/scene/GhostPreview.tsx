import { Line } from '@react-three/drei'
import { usePlacementStore, yawFromQuaternion } from '@/stores/placementStore'
import { EntityRenderer } from '@/entities/EntityRenderer'
import type { AnyEntity, Quaternion, Vec3 } from '@/types/protocol'

const LINE_LENGTH = 1
const LINE_Z = 0.06
const LINE_COLOR = '#00cccc'

function HeadingLine({ position, orientation }: { position: Vec3; orientation: Quaternion }) {
  const yaw = yawFromQuaternion(orientation)
  const z = position.z + LINE_Z
  const start: [number, number, number] = [position.x, position.y, z]
  const end: [number, number, number] = [
    position.x + Math.cos(yaw) * LINE_LENGTH,
    position.y + Math.sin(yaw) * LINE_LENGTH,
    z,
  ]
  return <Line points={[start, end]} color={LINE_COLOR} lineWidth={2} transparent opacity={0.5} />
}

function makeGhost(type: string, id: string, position: Vec3, orientation: Quaternion, config?: any): AnyEntity {
  return {
    type,
    id,
    position,
    orientation,
    ...(type === 'box' ? { scale: config?.size ?? { x: 0.3, y: 0.3, z: 0.3 }, is_movable: true } : {}),
    ...(type === 'cylinder' ? { radius: config?.radius ?? 0.15, height: config?.height ?? 0.5, is_movable: true } : {}),
    ...((type === 'foot-bot' || type === 'kheperaiv') ? { leds: [], rays: [], points: [] } : {}),
  } as AnyEntity
}

const IDENTITY_Q: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

export function GhostPreview() {
  const { active, config, cursorPos, dragging, dragOrientation, previewPositions, previewOrientations, previewType } = usePlacementStore()

  return (
    <>
      {/* Single ghost at cursor for click-to-place */}
      {active && config && cursorPos && (
        <>
          <EntityRenderer entity={makeGhost(config.type, '__ghost_cursor', cursorPos, dragOrientation, config)} ghost />
          {dragging && <HeadingLine position={cursorPos} orientation={dragOrientation} />}
        </>
      )}

      {/* Multiple ghosts for distribute preview */}
      {previewType && previewPositions.map((pos, i) => {
        const ori = previewOrientations[i] ?? IDENTITY_Q
        return (
          <group key={i}>
            <EntityRenderer entity={makeGhost(previewType, `__ghost_dist_${i}`, pos, ori)} ghost />
            {previewOrientations.length > 0 && <HeadingLine position={pos} orientation={ori} />}
          </group>
        )
      })}
    </>
  )
}
