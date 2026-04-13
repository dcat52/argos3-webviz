import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { EntityRenderer } from '../entities/EntityRenderer'
import type { AnyEntity, ArenaInfo } from '../types/protocol'

function ArenaBounds({ arena }: { arena: ArenaInfo }) {
  const { size, center } = arena
  return (
    <mesh position={[center.x, center.y, center.z + size.z / 2]}>
      <boxGeometry args={[size.x, size.y, size.z]} />
      <meshBasicMaterial wireframe color="#444" />
    </mesh>
  )
}

function SceneEntities() {
  const { entities, selectedEntityId, selectEntity } = useExperimentStore(
    useShallow((s) => ({
      entities: s.entities,
      selectedEntityId: s.selectedEntityId,
      selectEntity: s.selectEntity,
    }))
  )

  return (
    <>
      {Array.from(entities.values()).map((entity: AnyEntity) =>
        'position' in entity ? (
          <EntityRenderer
            key={entity.id}
            entity={entity}
            selected={entity.id === selectedEntityId}
            onClick={() => selectEntity(entity.id)}
          />
        ) : null
      )}
    </>
  )
}

export function Scene() {
  const arena = useExperimentStore((s) => s.arena)

  useEffect(() => {
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1)
  }, [])

  return (
    <Canvas
      camera={{ position: [5, -5, 5], up: [0, 0, 1], fov: 50 }}
      className="!absolute inset-0"
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, -10, 10]} intensity={0.8} />
      <OrbitControls enableDamping maxPolarAngle={Math.PI / 2} />
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellColor="#333"
        sectionSize={5}
        sectionColor="#555"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
      />
      <SceneEntities />
      {arena && <ArenaBounds arena={arena} />}
    </Canvas>
  )
}
