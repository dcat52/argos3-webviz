import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows, Line } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { EntityRenderer } from '../entities/EntityRenderer'
import type { AnyEntity, ArenaInfo } from '../types/protocol'

function ArenaBounds({ arena }: { arena: ArenaInfo }) {
  const { size, center } = arena
  const hw = size.x / 2, hd = size.y / 2
  const cx = center.x, cy = center.y
  const pts: [number, number, number][] = [
    [cx - hw, cy - hd, 0], [cx + hw, cy - hd, 0],
    [cx + hw, cy + hd, 0], [cx - hw, cy + hd, 0],
    [cx - hw, cy - hd, 0],
  ]
  return <Line points={pts} color="#bbb" lineWidth={1.5} />
}

function SceneEntities() {
  const { entities, selectedEntityId, selectEntity } = useExperimentStore(
    useShallow((s) => ({ entities: s.entities, selectedEntityId: s.selectedEntityId, selectEntity: s.selectEntity }))
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
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      {/* Light neutral background */}
      <color attach="background" args={['#f0f0f0']} />
      <fog attach="fog" args={['#f0f0f0', 20, 50]} />

      {/* Lighting — bright and clean */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[8, -6, 12]}
        intensity={1.2}
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
      <directionalLight position={[-5, 8, 4]} intensity={0.3} color="#aaccff" />
      <hemisphereLight args={['#ddeeff', '#f0eeee', 0.4]} />

      {/* Soft ground shadows */}
      <ContactShadows
        position={[0, 0, -0.001]}
        opacity={0.3}
        scale={30}
        blur={2.5}
        far={4}
        color="#334"
      />

      {/* Ground grid */}
      <Grid
        args={[40, 40]}
        cellSize={0.5}
        cellColor="#ddd"
        sectionSize={5}
        sectionColor="#bbb"
        fadeDistance={30}
        fadeStrength={1.5}
        infiniteGrid
        side={THREE.DoubleSide}
      />

      <OrbitControls enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} minDistance={0.5} maxDistance={50} />

      <SceneEntities />
      {arena && <ArenaBounds arena={arena} />}

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.3} intensity={0.3} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
