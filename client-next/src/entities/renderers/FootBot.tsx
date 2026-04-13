import { useMemo } from 'react'
import * as THREE from 'three'
import { EntityRendererProps } from '../registry'
import { FootBotEntity } from '../../types/protocol'

function parseHex(hex: string): string {
  return '#' + hex.slice(2)
}

function parseRay(ray: string) {
  const [checked, startStr, endStr] = ray.split(':')
  const start = startStr.split(',').map(Number) as [number, number, number]
  const end = endStr.split(',').map(Number) as [number, number, number]
  return { hit: checked === 'true', start, end }
}

export function FootBot({ entity, selected, onClick }: EntityRendererProps) {
  const e = entity as FootBotEntity
  const { position: p, orientation: q } = e

  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.085, 0.085, 0.146, 16), [])
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.005, 8, 8), [])

  const leds = useMemo(() => {
    return e.leds.map((hex, i) => {
      const angle = (i / 12) * Math.PI * 2
      const x = Math.cos(angle) * 0.075
      const y = Math.sin(angle) * 0.075
      return { color: parseHex(hex), x, y, z: 0.073 }
    })
  }, [e.leds])

  const rays = useMemo(() => {
    return e.rays.map((r) => parseRay(r))
  }, [e.rays])

  return (
    <group
      position={[p.x, p.y, p.z]}
      quaternion={[q.x, q.y, q.z, q.w]}
      onClick={onClick}
    >
      {/* Body cylinder — rotate from Y-up to Z-up */}
      <mesh geometry={bodyGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="gray"
          emissive={selected ? '#444400' : '#000000'}
        />
      </mesh>

      {/* LEDs */}
      {leds.map((led, i) => (
        <mesh key={i} geometry={ledGeo} position={[led.x, led.y, led.z]}>
          <meshStandardMaterial color={led.color} emissive={led.color} />
        </mesh>
      ))}

      {/* Sensor rays */}
      {rays.map((ray, i) => (
        <line key={`ray-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([...ray.start, ...ray.end]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={ray.hit ? 'green' : 'red'} />
        </line>
      ))}
    </group>
  )
}
