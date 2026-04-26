import { useMemo } from 'react'
import * as THREE from 'three'
import { EntityRendererProps } from '../registry'
import { CylinderEntity } from '../../types/protocol'

const _ledGeo = new THREE.SphereGeometry(0.006, 12, 12)

export function CylinderRenderer({ entity, selected, ghost, onClick, onDoubleClick, onPointerDown, overrideColor }: EntityRendererProps) {
  const e = entity as CylinderEntity
  const { position: p, orientation: q } = e
  const color = overrideColor ?? (ghost ? '#64C8FF' : (selected ? '#8899aa' : (e as any).color ?? (e.is_movable ? '#44aa88' : '#555566')))

  const localLeds = useMemo(() => {
    if (!e.leds?.length) return []
    const ep = new THREE.Vector3(p.x, p.y, p.z + e.height / 2)
    const iq = new THREE.Quaternion(q.x, q.y, q.z, q.w).invert()
    return e.leds.map(led => ({
      color: led.color,
      pos: new THREE.Vector3(led.position.x, led.position.y, led.position.z).sub(ep).applyQuaternion(iq),
    }))
  }, [e.leds, p.x, p.y, p.z, q.x, q.y, q.z, q.w, e.height])

  return (
    <group position={[p.x, p.y, p.z + e.height / 2]} quaternion={[q.x, q.y, q.z, q.w]} onClick={onClick} onDoubleClick={onDoubleClick} onPointerDown={onPointerDown}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[e.radius, e.radius, e.height, 24]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.1}
          roughness={0.6}
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
