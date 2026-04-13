import { useMemo } from 'react'
import * as THREE from 'three'
import { EntityRendererProps } from '../registry'
import { KheperaIVEntity } from '../../types/protocol'

function parseHex(hex: string): string {
  return '#' + hex.slice(2)
}

function parseRay(ray: string) {
  const [checked, startStr, endStr] = ray.split(':')
  const start = startStr.split(',').map(Number) as [number, number, number]
  const end = endStr.split(',').map(Number) as [number, number, number]
  return { hit: checked === 'true', start, end }
}

export function KheperaIV({ entity, selected, onClick }: EntityRendererProps) {
  const e = entity as KheperaIVEntity
  const { position: p, orientation: q } = e

  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.07, 0.07, 0.054, 16), [])
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.005, 8, 8), [])

  const leds = useMemo(() => {
    return e.leds.map((hex, i) => {
      const angle = (i / 3) * Math.PI * 2
      const x = Math.cos(angle) * 0.06
      const y = Math.sin(angle) * 0.06
      return { color: parseHex(hex), x, y, z: 0.027 }
    })
  }, [e.leds])

  const rays = useMemo(() => e.rays.map((r) => parseRay(r)), [e.rays])

  return (
    <group
      position={[p.x, p.y, p.z]}
      quaternion={[q.x, q.y, q.z, q.w]}
      onClick={onClick}
    >
      <mesh geometry={bodyGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="gray"
          emissive={selected ? '#444400' : '#000000'}
        />
      </mesh>

      {leds.map((led, i) => (
        <mesh key={i} geometry={ledGeo} position={[led.x, led.y, led.z]}>
          <meshStandardMaterial color={led.color} emissive={led.color} />
        </mesh>
      ))}

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
