import { useMemo } from 'react'
import * as THREE from 'three'
import { EntityRendererProps } from '../registry'
import { LightEntity } from '../../types/protocol'

export function LightRenderer({ entity, onClick }: EntityRendererProps) {
  const e = entity as LightEntity
  const { position: p } = e
  const color = '#' + e.color.slice(2)

  const geo = useMemo(() => new THREE.SphereGeometry(0.02, 8, 8), [])

  return (
    <group position={[p.x, p.y, p.z]} onClick={onClick}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <pointLight color={color} intensity={1} distance={5} />
    </group>
  )
}
