import { EntityRendererProps } from '../registry'
import { LightEntity } from '../../types/protocol'

function parseHex(hex: string): string {
  return '#' + hex.slice(2)
}

export function LightRenderer({ entity, onClick, onDoubleClick }: EntityRendererProps) {
  const e = entity as LightEntity
  const { position: p } = e
  const color = parseHex(e.color)
  return (
    <group position={[p.x, p.y, p.z]} onClick={onClick} onDoubleClick={onDoubleClick}>
      <mesh>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={color} intensity={2} distance={5} decay={2} />
    </group>
  )
}
