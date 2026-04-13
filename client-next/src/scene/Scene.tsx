import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { useSceneSettingsStore } from '../stores/sceneSettingsStore'
import { EntityRenderer } from '../entities/EntityRenderer'
import { EnvironmentPreset } from './EnvironmentPreset'
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

function CameraSetup() {
  const arena = useExperimentStore((s) => s.arena)
  const { camera } = useThree()
  const initialized = useRef(false)

  useEffect(() => {
    if (!arena || initialized.current) return
    initialized.current = true
    const dist = Math.max(arena.size.x, arena.size.y) * 1.2
    const azimuth = -Math.PI / 2 + Math.PI / 6
    const elevation = Math.PI / 5
    const cx = arena.center.x, cy = arena.center.y
    camera.position.set(
      cx + dist * Math.cos(elevation) * Math.sin(azimuth),
      cy + dist * Math.cos(elevation) * Math.cos(azimuth),
      dist * Math.sin(elevation)
    )
    camera.lookAt(cx, cy, 0)
    camera.updateProjectionMatrix()
  }, [arena, camera])

  return null
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

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

export function Scene() {
  const arena = useExperimentStore((s) => s.arena)
  const envPreset = useSceneSettingsStore((s) => s.envPreset)
  const target: [number, number, number] = arena ? [arena.center.x, arena.center.y, 0] : [0, 0, 0]

  return (
    <Canvas
      camera={{ position: [0, -12, 10], up: [0, 0, 1], fov: 50 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      {/* Environment preset (sets background, fog, ground) */}
      <EnvironmentPreset preset={envPreset} arena={arena} />

      {/* Lighting */}
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

      <OrbitControls target={target} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} minDistance={0.5} maxDistance={50} />

      <CameraSetup />
      <SceneEntities />
      {arena && <ArenaBounds arena={arena} />}

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.3} intensity={0.3} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
