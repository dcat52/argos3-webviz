import { EntityRendererProps } from '../registry'
import { BoxEntity } from '../../types/protocol'

export function BoxRenderer({ entity, selected, onClick, onDoubleClick }: EntityRendererProps) {
  const e = entity as BoxEntity
  const { position: p, orientation: q, scale: s } = e
  return (
    <mesh
      position={[p.x, p.y, p.z + s.z / 2]}
      quaternion={[q.x, q.y, q.z, q.w]}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[s.x, s.y, s.z]} />
      <meshPhysicalMaterial
        color={selected ? '#8899aa' : e.is_movable ? '#4488cc' : '#555566'}
        metalness={0.1}
        roughness={0.7}
      />
    </mesh>
  )
}
