import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { EntityRendererProps } from '../registry'
import { useSettingsStore } from '@/stores/settingsStore'
import { KheperaIVEntity } from '../../types/protocol'

function parseHex(hex: string): string {
  return '#' + hex.slice(2)
}

function parseRay(ray: string) {
  const [checked, startStr, endStr] = ray.split(':')
  const s = startStr.split(',').map(Number) as [number, number, number]
  const e = endStr.split(',').map(Number) as [number, number, number]
  return { hit: checked === 'true', start: s, end: e }
}

export function KheperaIV({ entity, selected, ghost, tier, onClick, onDoubleClick, onPointerDown, overrideColor }: EntityRendererProps) {
  const e = entity as KheperaIVEntity
  const { position: p, orientation: q } = e
  const t = tier ?? 2

  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.07, 0.07, 0.054, 24), [])
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.006, 12, 12), [])

  const leds = useMemo(() =>
    e.leds.map((hex, i) => {
      const angle = (i / 3) * Math.PI * 2
      return { color: parseHex(hex), x: Math.cos(angle) * 0.06, y: Math.sin(angle) * 0.06, z: 0.028 }
    }), [e.leds])

  const rays = useMemo(() => t >= 3 ? e.rays.map(parseRay) : [], [e.rays, t])

  return (
    <group position={[p.x, p.y, p.z]} quaternion={[q.x, q.y, q.z, q.w]} onClick={onClick} onDoubleClick={onDoubleClick} onPointerDown={onPointerDown}>
      {/* Tier 1+: Body */}
      <mesh geometry={bodyGeo} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={overrideColor ?? (ghost ? '#64C8FF' : (selected ? '#5577aa' : '#2a3a4a'))}
          metalness={0.05}
          roughness={0.8}
          clearcoat={0}
        />
      </mesh>

      {/* Tier 1+: LEDs */}
      {leds.map((led, i) => (
        <mesh key={i} geometry={ledGeo} position={[led.x, led.y, led.z]}>
          <meshStandardMaterial color={led.color} emissive={led.color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}

      {/* Tier 2+: Top cap */}
      {t >= 2 && <mesh position={[0, 0, 0.027]}>
        <circleGeometry args={[0.05, 24]} />
        <meshPhysicalMaterial color="#334455" metalness={0.05} roughness={0.8} />
      </mesh>}

      {/* Tier 3: Debug rays */}
      {rays.map((ray, i) => (
        <Line key={`ray-${i}`} points={[ray.start, ray.end]}
          color={ray.hit ? useSettingsStore.getState().rayHitColor : useSettingsStore.getState().rayMissColor}
          lineWidth={1} transparent opacity={0.5} />
      ))}
    </group>
  )
}
