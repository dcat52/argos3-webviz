import { useMemo } from 'react'
import * as THREE from 'three'
import { EntityRendererProps } from '../registry'
import { BoxEntity } from '../../types/protocol'

const _ledGeo = new THREE.SphereGeometry(0.006, 12, 12)

export function BoxRenderer({ entity, selected, ghost, onClick, onDoubleClick, onPointerDown, overrideColor }: EntityRendererProps) {
  const e = entity as BoxEntity
  const { position: p, orientation: q, scale: s } = e
  const color = overrideColor ?? (ghost ? '#64C8FF' : (selected ? '#8899aa' : (e as any).color ?? (e.is_movable ? '#4488cc' : '#555566')))

  const localLeds = useMemo(() => {
    if (!e.leds?.length) return []
    const ep = new THREE.Vector3(p.x, p.y, p.z + s.z / 2)
    const iq = new THREE.Quaternion(q.x, q.y, q.z, q.w).invert()
    return e.leds.map(led => ({
      color: led.color,
      pos: new THREE.Vector3(led.position.x, led.position.y, led.position.z).sub(ep).applyQuaternion(iq),
    }))
  }, [e.leds, p.x, p.y, p.z, q.x, q.y, q.z, q.w, s.z])

  return (
    <group
      position={[p.x, p.y, p.z + s.z / 2]}
      quaternion={[q.x, q.y, q.z, q.w]}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[s.x, s.y, s.z]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.1}
          roughness={0.7}
          transparent={ghost}
          opacity={ghost ? 0.3 : 1}
          depthWrite={!ghost}
        />
      </mesh>
      {localLeds.map((led, i) => (
        <mesh key={i} geometry={_ledGeo} position={led.pos}>
          <meshStandardMaterial color={led.color} emissive={led.color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
