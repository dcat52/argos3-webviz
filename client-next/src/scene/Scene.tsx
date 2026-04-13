import { useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { useSceneSettingsStore } from '../stores/sceneSettingsStore'
import { useCameraStore } from '../stores/cameraStore'
import { EntityRenderer } from '../entities/EntityRenderer'
import { EnvironmentPreset } from './EnvironmentPreset'
import { CameraController } from './CameraController'
import { SelectionRing } from './SelectionRing'
import { FPSCounter } from './FPSCounter'
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
  const flyTo = useCameraStore((s) => s.flyTo)

  const handleDoubleClick = useCallback((entity: AnyEntity) => {
    if ('position' in entity) {
      flyTo([entity.position.x, entity.position.y, entity.position.z])
    }
  }, [flyTo])

  return (
    <>
      {Array.from(entities.values()).map((entity: AnyEntity) =>
        'position' in entity ? (
          <group key={entity.id}>
            <EntityRenderer
              entity={entity}
              selected={entity.id === selectedEntityId}
              onClick={() => selectEntity(entity.id)}
              onDoubleClick={() => handleDoubleClick(entity)}
            />
            {entity.id === selectedEntityId && (
              <group position={[entity.position.x, entity.position.y, entity.position.z]}>
                <SelectionRing />
              </group>
            )}
          </group>
        ) : null
      )}
    </>
  )
}

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

export function Scene() {
  const arena = useExperimentStore((s) => s.arena)
  const envPreset = useSceneSettingsStore((s) => s.envPreset)

  return (
    <Canvas
      camera={{ position: [0, -12, 10], up: [0, 0, 1], fov: 50 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <EnvironmentPreset preset={envPreset} arena={arena} />

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

      <CameraController />
      <SceneEntities />
      {arena && <ArenaBounds arena={arena} />}
      <FPSCounter />

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.3} intensity={0.3} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
