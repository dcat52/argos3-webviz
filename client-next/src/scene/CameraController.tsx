import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useExperimentStore } from '@/stores/experimentStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCameraStore, type CameraPreset } from '@/stores/cameraStore'
import { CAMERA } from '@/lib/defaults'
import CameraControlsImpl from 'camera-controls'

/** Small margin so the arena doesn't touch the viewport edges exactly. */
const FIT_PADDING = 1.05

/**
 * Compute the camera distance needed to fit the arena plane in the viewport.
 * Uses vertical FOV and aspect ratio to find the tightest fit.
 */
function fitDistance(arenaW: number, arenaH: number, vFovRad: number, aspect: number): number {
  const halfVFov = vFovRad / 2
  const halfHFov = Math.atan(aspect * Math.tan(halfVFov))
  /* Distance needed so arena height fits vertically */
  const dV = (arenaH / 2) / Math.tan(halfVFov)
  /* Distance needed so arena width fits horizontally */
  const dH = (arenaW / 2) / Math.tan(halfHFov)
  return Math.max(dV, dH) * FIT_PADDING
}

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
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    setCameraControlsRef(ref);
    (globalThis as any).__cameraControlsRef = ref
  }, [setCameraControlsRef])

  const minDist = useSettingsStore((s) => s.cameraMinDistance)
  const maxDistMult = useSettingsStore((s) => s.cameraMaxDistanceMultiplier)
  const smoothTime = useSettingsStore((s) => s.cameraSmoothTime)
  const fov = useSettingsStore((s) => s.fov)

  useEffect(() => {
    if (!ref.current || !arena) return
    if (initialized.current && preset === prevPreset.current) return
    initialized.current = true
    const vFovRad = (fov * Math.PI) / 180
    const aspect = gl.domElement.clientWidth / gl.domElement.clientHeight
    const dist = fitDistance(arena.size.x, arena.size.y, vFovRad, aspect)
    const { pos, target } = getPresetPos(preset, arena.center.x, arena.center.y, dist)
    ref.current.setLookAt(pos[0], pos[1], pos[2], target[0], target[1], target[2], true)
    prevPreset.current = preset
  }, [preset, arena, fov, gl])

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
