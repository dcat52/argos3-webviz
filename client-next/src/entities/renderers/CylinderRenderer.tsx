import { useMemo } from 'react'
import * as THREE from 'three'
import { EntityRendererProps } from '../registry'
import { CylinderEntity } from '../../types/protocol'

export function CylinderRenderer({ entity, selected, onClick }: EntityRendererProps) {
  const e = entity as CylinderEntity
  const { position: p, orientation: q } = e

  const geo = useMemo(
    () => new THREE.CylinderGeometry(e.radius, e.radius, e.height, 16),
    [e.radius, e.height],
  )

  return (
    <group
      position={[p.x, p.y, p.z]}
      quaternion={[q.x, q.y, q.z, q.w]}
      onClick={onClick}
    >
      {/* Rotate from Y-up to Z-up */}
      <mesh geometry={geo} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={e.is_movable ? '#4488cc' : 'gray'}
          emissive={selected ? '#444400' : '#000000'}
        />
      </mesh>
    </group>
  )
}
