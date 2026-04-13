import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, ContactShadows, Line } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { EntityRenderer } from '../entities/EntityRenderer'
import type { AnyEntity, ArenaInfo } from '../types/protocol'

function ArenaBounds({ arena }: { arena: ArenaInfo }) {
  const { size, center } = arena
  const hw = size.x / 2, hd = size.y / 2
  const cx = center.x, cy = center.y
  const points: [number, number, number][] = [
    [cx - hw, cy - hd, 0],
    [cx + hw, cy - hd, 0],
    [cx + hw, cy + hd, 0],
    [cx - hw, cy + hd, 0],
    [cx - hw, cy - hd, 0],
  ]
  return <Line points={points} color="#555" lineWidth={1} />
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
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[8, -6, 12]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-5, 8, 4]} intensity={0.3} color="#8888ff" />

      {/* Environment reflections */}
      <Environment preset="city" background={false} />

      {/* Soft contact shadows on the ground */}
      <ContactShadows
        position={[0, 0, -0.001]}
        rotation={[0, 0, 0]}
        opacity={0.4}
        scale={30}
        blur={2}
        far={4}
        color="#000020"
      />

      {/* Ground grid */}
      <Grid
        args={[40, 40]}
        cellSize={0.5}
        cellColor="#222238"
        sectionSize={5}
        sectionColor="#333355"
        fadeDistance={30}
        fadeStrength={1.5}
        infiniteGrid
        side={THREE.DoubleSide}
      />

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={0.5}
        maxDistance={50}
      />

      {/* Entities */}
      <SceneEntities />
      {arena && <ArenaBounds arena={arena} />}

      {/* Post-processing */}
      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.3}
          intensity={0.4}
        />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
