import { EntityRendererProps } from '../registry'
import { BoxEntity } from '../../types/protocol'

export function BoxRenderer({ entity, selected, onClick }: EntityRendererProps) {
  const e = entity as BoxEntity
  const { position: p, orientation: q, scale: s } = e

  return (
    <mesh
      position={[p.x, p.y, p.z]}
      quaternion={[q.x, q.y, q.z, q.w]}
      onClick={onClick}
    >
      <boxGeometry args={[s.x, s.y, s.z]} />
      <meshStandardMaterial
        color={e.is_movable ? '#4488cc' : 'gray'}
        emissive={selected ? '#444400' : '#000000'}
      />
    </mesh>
  )
}
