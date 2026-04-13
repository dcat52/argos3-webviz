import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useExperimentStore } from '@/stores/experimentStore'
import { useCameraStore, type CameraPreset } from '@/stores/cameraStore'
import CameraControlsImpl from 'camera-controls'

function getPresetPos(preset: CameraPreset, cx: number, cy: number, dist: number): { pos: [number, number, number]; target: [number, number, number] } {
  const target: [number, number, number] = [cx, cy, 0]
  switch (preset) {
    case 'top': return { pos: [cx, cy, dist], target }
    case 'side': return { pos: [cx, cy - dist, dist * 0.3], target }
    case 'isometric': {
      const az = -Math.PI / 2 + Math.PI / 6
      const el = Math.PI / 5
      return { pos: [cx + dist * Math.cos(el) * Math.sin(az), cy + dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el)], target }
    }
    case 'follow': return { pos: [cx, cy, dist], target } // will be overridden per-frame
  }
}

export function CameraController() {
  const ref = useRef<CameraControlsImpl>(null)
  const preset = useCameraStore((s) => s.preset)
  const flyToTarget = useCameraStore((s) => s.flyToTarget)
  const clearFlyTo = useCameraStore((s) => s.clearFlyTo)
  const arena = useExperimentStore((s) => s.arena)
  const prevPreset = useRef(preset)

  // Apply preset changes
  useEffect(() => {
    if (!ref.current || !arena) return
    const dist = Math.max(arena.size.x, arena.size.y) * 1.2
    const { pos, target } = getPresetPos(preset, arena.center.x, arena.center.y, dist)
    ref.current.setLookAt(pos[0], pos[1], pos[2], target[0], target[1], target[2], true)
    prevPreset.current = preset
  }, [preset, arena])

  // Fly-to on double-click
  useEffect(() => {
    if (!ref.current || !flyToTarget) return
    const [tx, ty, tz] = flyToTarget
    const cam = ref.current
    // Move target to entity, keep relative camera offset but closer
    cam.setLookAt(tx + 1, ty - 1, tz + 1.5, tx, ty, tz, true)
    clearFlyTo()
  }, [flyToTarget, clearFlyTo])

  // Follow mode: track selected entity
  useFrame(() => {
    if (preset !== 'follow' || !ref.current) return
    const { selectedEntityId, entities } = useExperimentStore.getState()
    if (!selectedEntityId) return
    const entity = entities.get(selectedEntityId)
    if (!entity || !('position' in entity)) return
    const { x, y, z } = entity.position
    ref.current.setTarget(x, y, z, false)
  })

  return (
    <CameraControls
      ref={ref}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={0.5}
      maxDistance={50}
      smoothTime={0.25}
    />
  )
}
