import { EntityRendererProps } from '../registry'
import { CylinderEntity } from '../../types/protocol'

export function CylinderRenderer({ entity, selected, ghost, onClick, onDoubleClick, onPointerDown, overrideColor }: EntityRendererProps) {
  const e = entity as CylinderEntity
  const { position: p, orientation: q } = e
  const color = overrideColor ?? (ghost ? '#64C8FF' : (selected ? '#8899aa' : (e as any).color ?? (e.is_movable ? '#44aa88' : '#555566')))
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
    </group>
  )
}
