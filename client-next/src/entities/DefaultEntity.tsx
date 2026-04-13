import { EntityRendererProps } from './registry'

export function DefaultEntity({ entity, selected, onClick, onDoubleClick, overrideColor }: EntityRendererProps) {
  const hasPosition = 'position' in entity
  const position = hasPosition ? entity.position : { x: 0, y: 0, z: 0 }
  const hasOrientation = 'orientation' in entity
  const orientation = hasOrientation ? entity.orientation : { x: 0, y: 0, z: 0, w: 1 }

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      quaternion={[orientation.x, orientation.y, orientation.z, orientation.w]}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial color={overrideColor ?? (selected ? 'yellow' : 'orange')} />
    </mesh>
  )
}
