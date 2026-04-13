import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { EntityRendererProps } from '../registry'
import { FootBotEntity } from '../../types/protocol'

function parseHex(hex: string): string {
  return '#' + hex.slice(2)
}

function parseRay(ray: string) {
  const [checked, startStr, endStr] = ray.split(':')
  const s = startStr.split(',').map(Number) as [number, number, number]
  const e = endStr.split(',').map(Number) as [number, number, number]
  return { hit: checked === 'true', start: s, end: e }
}

export function FootBot({ entity, selected, onClick, onDoubleClick, overrideColor }: EntityRendererProps) {
  const e = entity as FootBotEntity
  const { position: p, orientation: q } = e

  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.085, 0.085, 0.146, 24), [])
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.006, 12, 12), [])

  const leds = useMemo(() =>
    e.leds.map((hex, i) => {
      const angle = (i / 12) * Math.PI * 2
      return { color: parseHex(hex), x: Math.cos(angle) * 0.075, y: Math.sin(angle) * 0.075, z: 0.074 }
    }), [e.leds])

  const rays = useMemo(() => e.rays.map(parseRay), [e.rays])

  return (
    <group position={[p.x, p.y, p.z]} quaternion={[q.x, q.y, q.z, q.w]} onClick={onClick} onDoubleClick={onDoubleClick}>
      {/* Body */}
      <mesh geometry={bodyGeo} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={overrideColor ?? (selected ? '#5577aa' : '#2a2a3a')}
          metalness={0.3}
          roughness={0.4}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* Top ring accent */}
      <mesh position={[0, 0, 0.073]}>
        <torusGeometry args={[0.075, 0.003, 8, 24]} />
        <meshPhysicalMaterial color="#555" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* LEDs — emissive for bloom */}
      {leds.map((led, i) => (
        <mesh key={i} geometry={ledGeo} position={[led.x, led.y, led.z]}>
          <meshStandardMaterial
            color={led.color}
            emissive={led.color}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Sensor rays */}
      {rays.map((ray, i) => (
        <Line
          key={`ray-${i}`}
          points={[ray.start, ray.end]}
          color={ray.hit ? '#44ff44' : '#ff4444'}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </group>
  )
}
