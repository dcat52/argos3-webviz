import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useExperimentStore } from '@/stores/experimentStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCameraStore, type CameraPreset } from '@/stores/cameraStore'
import { CAMERA } from '@/lib/defaults'
import CameraControlsImpl from 'camera-controls'

function getPresetPos(preset: CameraPreset, cx: number, cy: number, dist: number): { pos: [number, number, number]; target: [number, number, number] } {
  const target: [number, number, number] = [cx, cy, 0]
  switch (preset) {
    case 'top': return { pos: [cx, cy, dist], target }
    case 'side': return { pos: [cx, cy - dist, dist * 0.3], target }
    case 'isometric': {
      const d = dist * 0.8
      return { pos: [cx + d * 0.5, cy - d * 0.5, d * 0.7], target }
    }
    case 'follow': return { pos: [cx, cy, dist], target }
  }
}

export function CameraController() {
  const ref = useRef<CameraControlsImpl>(null)
  const preset = useCameraStore((s) => s.preset)
  const flyToTarget = useCameraStore((s) => s.flyToTarget)
  const clearFlyTo = useCameraStore((s) => s.clearFlyTo)
  const setCameraControlsRef = useCameraStore((s) => s.setCameraControlsRef)
  const arena = useExperimentStore((s) => s.arena)
  const prevPreset = useRef(preset)
  const initialized = useRef(false)

  useEffect(() => {
    setCameraControlsRef(ref);
    (window as any).__cameraControlsRef = ref
  }, [setCameraControlsRef])

  const minDist = useSettingsStore((s) => s.cameraMinDistance)
  const maxDistMult = useSettingsStore((s) => s.cameraMaxDistanceMultiplier)
  const smoothTime = useSettingsStore((s) => s.cameraSmoothTime)

  useEffect(() => {
    if (!ref.current || !arena) return
    if (initialized.current && preset === prevPreset.current) return
    initialized.current = true
    const dist = Math.max(arena.size.x, arena.size.y) * CAMERA.arenaDistanceMultiplier
    const { pos, target } = getPresetPos(preset, arena.center.x, arena.center.y, dist)
    ref.current.setLookAt(pos[0], pos[1], pos[2], target[0], target[1], target[2], true)
    prevPreset.current = preset
  }, [preset, arena])

  useEffect(() => {
    if (!ref.current || !flyToTarget) return
    const [tx, ty, tz] = flyToTarget
    const fo = CAMERA.followOffset
    ref.current.setLookAt(tx + fo[0], ty + fo[1], tz + fo[2], tx, ty, tz, true)
    clearFlyTo()
  }, [flyToTarget, clearFlyTo])

  useFrame(() => {
    if (preset !== 'follow' || !ref.current) return
    const { selectedEntityId, entities } = useExperimentStore.getState()
    if (!selectedEntityId) return
    const entity = entities.get(selectedEntityId)
    if (!entity || !('position' in entity)) return
    const { x, y, z } = entity.position
    ref.current.setTarget(x, y, z, false)
  })

  const maxDist = arena ? Math.max(arena.size.x, arena.size.y) * maxDistMult : 200

  return (
    <CameraControls
      ref={ref}
      maxPolarAngle={CAMERA.maxPolarAngle}
      minDistance={minDist}
      maxDistance={maxDist}
      smoothTime={smoothTime}
    />
  )
}
