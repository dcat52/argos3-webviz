import { useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { useSceneSettingsStore } from '../stores/sceneSettingsStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useCameraStore } from '../stores/cameraStore'
import { useVizConfigStore } from '../stores/vizConfigStore'
import { useCanvasRef } from '../stores/canvasRefStore'
import { APP_MODE } from '../lib/params'
import { EntityRenderer } from '../entities/EntityRenderer'
import { EnvironmentPreset } from './EnvironmentPreset'
import { CameraController } from './CameraController'
import { SelectionRing } from './SelectionRing'
import { GhostPreview } from './GhostPreview'
import { useDrag } from '../hooks/useDrag'
import { FPSCounter } from './FPSCounter'
import { EntityLinks } from './EntityLinks'
import { TrailRenderer } from './TrailRenderer'
import { HeatmapOverlay } from './HeatmapOverlay'
import { useFeature } from '@/stores/featureStore'
import { FloatingLabels } from './FloatingLabels'
import { DrawOverlays } from './DrawOverlays'
import { DynamicFloor } from './DynamicFloor'
import { ScaleBarUpdater, ScaleBarOverlay } from './ScaleBar'
import { InstancedEntities, INSTANCED_TYPES, INDIVIDUAL_THRESHOLD } from './InstancedEntities'
import { discoverFields } from '../lib/vizEngine'
import { linearScale, categoricalScale } from '../lib/colorScales'
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

function useFieldDiscovery() {
  const entities = useExperimentStore((s) => s.entities)
  const computedFields = useExperimentStore((s) => s.computedFields)
  const setFields = useVizConfigStore((s) => s.setFields)
  const applyHints = useVizConfigStore((s) => s.applyHints)
  const userData = useExperimentStore((s) => s.userData)

  useEffect(() => {
    const fields = discoverFields(entities, computedFields)
    setFields(fields)
    if (userData && typeof userData === 'object' && '_viz_hints' in (userData as Record<string, unknown>)) {
      applyHints((userData as Record<string, unknown>)._viz_hints as Record<string, unknown>)
    }
  }, [entities, computedFields, setFields, applyHints, userData])
}

const AGENT_TYPES = new Set(['foot-bot', 'kheperaiv', 'Leo'])

export function useColorByMap(): Map<string, string> {
  const entities = useExperimentStore((s) => s.entities)
  const computedFields = useExperimentStore((s) => s.computedFields)
  const colorBy = useVizConfigStore((s) => s.config.colorBy)

  return useMemo(() => {
    const map = new Map<string, string>()
    if (!colorBy?.enabled || !colorBy.field) return map

    const isComputed = colorBy.field.startsWith('_')

    // Compute min/max for linear scale (agents only)
    let min = Infinity, max = -Infinity
    if (colorBy.scale === 'linear') {
      for (const entity of entities.values()) {
        if (!AGENT_TYPES.has(entity.type)) continue
        const val = isComputed
          ? computedFields.get(entity.id)?.[colorBy.field]
          : ('user_data' in entity && entity.user_data ? (entity.user_data as Record<string, unknown>)[colorBy.field] : undefined)
        if (typeof val === 'number') { min = Math.min(min, val); max = Math.max(max, val) }
      }
      if (min === Infinity) { min = 0; max = 1 }
    }

    for (const entity of entities.values()) {
      if (!AGENT_TYPES.has(entity.type)) continue
      const val = isComputed
        ? computedFields.get(entity.id)?.[colorBy.field]
        : ('user_data' in entity && entity.user_data ? (entity.user_data as Record<string, unknown>)[colorBy.field] : undefined)
      if (val === undefined) continue
      if (colorBy.scale === 'linear' && typeof val === 'number') {
        map.set(entity.id, linearScale(val, min, max, colorBy.colorA, colorBy.colorB))
      } else {
        map.set(entity.id, categoricalScale(String(val)))
      }
    }
    return map
  }, [entities, computedFields, colorBy])
}

function GlCapture() {
  const { gl, scene, camera } = useThree()
  const setGl = useCanvasRef((s) => s.setGl)
  useEffect(() => { setGl(gl, scene, camera) }, [gl, scene, camera, setGl])
  return null
}


function SceneEntities() {
  const { entities, selectedEntityId, selectEntity, debugPinnedIds } = useExperimentStore(
    useShallow((s) => ({ entities: s.entities, selectedEntityId: s.selectedEntityId, selectEntity: s.selectEntity, debugPinnedIds: s.debugPinnedIds }))
  )
  const flyTo = useCameraStore((s) => s.flyTo)
  const globalTier = useSettingsStore((s) => s.renderTier)
  const colorMap = useColorByMap()

  useDrag()

  const handleDoubleClick = useCallback((entity: AnyEntity) => {
    if ('position' in entity) {
      flyTo([entity.position.x, entity.position.y, entity.position.z])
    }
  }, [flyTo])

  // Tier >= 2 means all robots render individually (detailed model)
  // Tier 1 uses instancing for large groups
  const individual = useMemo(() => {
    if (globalTier >= 2) return Array.from(entities.values())
    const counts = new Map<string, number>()
    for (const e of entities.values()) {
      if (INSTANCED_TYPES.has(e.type)) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
    }
    return Array.from(entities.values()).filter((e) => {
      if (!INSTANCED_TYPES.has(e.type)) return true
      return (counts.get(e.type) ?? 0) <= INDIVIDUAL_THRESHOLD
    })
  }, [entities, globalTier])

  const effectiveTier = useCallback((id: string) => {
    if (debugPinnedIds.has(id)) return 3 as const
    if (id === selectedEntityId) return Math.min(globalTier + 1, 3) as 1 | 2 | 3
    return globalTier
  }, [globalTier, selectedEntityId, debugPinnedIds])

  return (
    <>
      {globalTier === 1 && <InstancedEntities colorMap={colorMap} />}
      <GhostPreview />
      {individual.map((entity: AnyEntity) =>
        'position' in entity ? (
          <group key={entity.id} name={entity.id}>
            <EntityRenderer
              entity={entity}
              selected={entity.id === selectedEntityId}
              tier={effectiveTier(entity.id)}
              onClick={() => selectEntity(entity.id)}
              onDoubleClick={() => handleDoubleClick(entity)}
              onPointerDown={(e: any) => { e.stopPropagation() }}
              overrideColor={colorMap.get(entity.id)}
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

function SceneContent() {
  const arena = useExperimentStore((s) => s.arena)
  const drawCommands = useExperimentStore((s) => s.drawCommands)
  const floorData = useExperimentStore((s) => s.floorData)
  const trailsEnabled = useFeature('trails')
  const heatmapEnabled = useFeature('heatmap')
  useFieldDiscovery()

  return (
    <>
      <GlCapture />
      <CameraController />
      <SceneEntities />
      <EntityLinks />
      {trailsEnabled && <TrailRenderer />}
      {heatmapEnabled && <HeatmapOverlay />}
      <FloatingLabels />
      <DrawOverlays commands={drawCommands} />
      {floorData && arena && <DynamicFloor floorData={floorData} arena={arena} />}
      {arena && <ArenaBounds arena={arena} />}
      <FPSCounter />
      <ScaleBarUpdater />
    </>
  )
}

function SettingsSync() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const fov = useSettingsStore((s) => s.fov)
  const pixelRatio = useSettingsStore((s) => s.pixelRatio)
  if ('fov' in camera && camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix() }
  gl.setPixelRatio(pixelRatio)
  return null
}

export function Scene() {
  const arena = useExperimentStore((s) => s.arena)
  const envPreset = useSceneSettingsStore((s) => s.envPreset)
  const shadows = useSettingsStore((s) => s.shadows)
  const pixelRatio = useSettingsStore((s) => s.pixelRatio)
  const fov = useSettingsStore((s) => s.fov)
  const orthographic = useSettingsStore((s) => s.orthographic)
  const [contextLost, setContextLost] = useState(false)
  const isViewer = APP_MODE === 'viewer'

  return (
    <>
    <Canvas
      key={`${shadows}-${orthographic}`}
      orthographic={orthographic}
      camera={orthographic
        ? { position: [0, -12, 10], up: [0, 0, 1], zoom: 50 }
        : { position: [0, -12, 10], up: [0, 0, 1], fov }
      }
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      shadows={shadows}
      dpr={pixelRatio}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: !isViewer }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          setContextLost(true)
        })
        gl.domElement.addEventListener('webglcontextrestored', () => setContextLost(false))
      }}
    >
      <EnvironmentPreset preset={envPreset} arena={arena} />

      <SettingsSync />

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
      <directionalLight position={[-5, 8, 4]} intensity={useSettingsStore.getState().directionalIntensity} color="#aaccff" />
      <hemisphereLight args={['#ddeeff', '#f0eeee', useSettingsStore.getState().hemisphereIntensity]} />

      <SceneContent />

      {!isViewer && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.3} intensity={0.3} />
          <SMAA />
        </EffectComposer>
      )}
    </Canvas>
    {contextLost && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm">
        WebGL context lost — too many viewports?
      </div>
    )}
    <ScaleBarOverlay />
    </>
  )
}
