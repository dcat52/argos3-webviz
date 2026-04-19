import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import type { EntityRendererProps } from '../registry'
import { useSettingsStore } from '@/stores/settingsStore'
import type { LeoEntity } from '../../types/protocol'

function parseRay(ray: string) {
  const [checked, startStr, endStr] = ray.split(':')
  const s = startStr.split(',').map(Number) as [number, number, number]
  const e = endStr.split(',').map(Number) as [number, number, number]
  return { hit: checked === 'true', start: s, end: e }
}

export function LeoRenderer({ entity, selected, onClick, onDoubleClick, overrideColor }: EntityRendererProps) {
  const e = entity as LeoEntity
  const { position: p, orientation: q } = e

  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.30, 0.30, 0.12, 24), [])
  const dirGeo = useMemo(() => new THREE.SphereGeometry(0.04, 8, 8), [])
  const rays = useMemo(() => e.rays.map(parseRay), [e.rays])

  return (
    <group position={[p.x, p.y, p.z]} quaternion={[q.x, q.y, q.z, q.w]} onClick={onClick} onDoubleClick={onDoubleClick}>
      <mesh geometry={bodyGeo} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={overrideColor ?? (selected ? '#6e8e6e' : '#5a6e5a')}
          metalness={0.05}
          roughness={0.8}
        />
      </mesh>

      {/* Direction indicator */}
      <mesh geometry={dirGeo} position={[0.20, 0, 0.06]}>
        <meshStandardMaterial color="#333" />
      </mesh>

      {rays.map((ray, i) => (
        <Line
          key={`ray-${i}`}
          points={[ray.start, ray.end]}
          color={ray.hit ? useSettingsStore.getState().rayHitColor : useSettingsStore.getState().rayMissColor}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </group>
  )
}
