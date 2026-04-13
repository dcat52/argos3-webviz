import { useMemo } from 'react'
import * as THREE from 'three'
import { EntityRendererProps } from '../registry'
import { FloorEntity } from '../../types/protocol'
import { useExperimentStore } from '../../stores/experimentStore'

export function FloorRenderer({ entity }: EntityRendererProps) {
  const e = entity as FloorEntity
  const arena = useExperimentStore((s) => s.arena)

  const size = arena?.size ?? { x: 4, y: 4, z: 0 }
  const center = arena?.center ?? { x: 0, y: 0, z: 0 }

  const texture = useMemo(() => {
    if (!e.floor_image) return null
    const loader = new THREE.TextureLoader()
    return loader.load(e.floor_image)
  }, [e.floor_image])

  return (
    <mesh position={[center.x, center.y, center.z - 0.001]}>
      <boxGeometry args={[size.x, size.y, 0.002]} />
      {texture ? (
        <meshStandardMaterial map={texture} />
      ) : (
        <meshStandardMaterial color="#333333" />
      )}
    </mesh>
  )
}
