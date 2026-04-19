import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { create } from 'zustand'

interface ScaleBarState {
  width: number
  label: string
  set: (w: number, l: string) => void
}

export const useScaleBarStore = create<ScaleBarState>((set) => ({
  width: 100,
  label: '1 m',
  set: (width, label) => set({ width, label }),
}))

function niceScale(metersPerPx: number, targetPx: number): { meters: number; label: string } {
  const raw = metersPerPx * targetPx
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]
  const m = steps.reduce((best, s) => Math.abs(s - raw) < Math.abs(best - raw) ? s : best, steps[0])
  const label = m >= 1 ? `${m} m` : `${Math.round(m * 100)} cm`
  return { meters: m, label }
}

/** Runs inside Canvas — reads camera, writes to store */
export function ScaleBarUpdater() {
  const { camera, size } = useThree()
  const update = useScaleBarStore((s) => s.set)
  const last = useRef(0)

  useFrame(() => {
    const now = performance.now()
    if (now - last.current < 250) return
    last.current = now

    const cam = camera as THREE.PerspectiveCamera
    const dist = cam.position.length()
    const vFov = (cam.fov * Math.PI) / 180
    const worldHeight = 2 * dist * Math.tan(vFov / 2)
    const metersPerPx = worldHeight / size.height

    const { meters, label } = niceScale(metersPerPx, 120)
    const width = Math.round(meters / metersPerPx)
    update(width, label)
  })

  return null
}

/** Rendered outside Canvas — fixed DOM position */
export function ScaleBarOverlay() {
  const width = useScaleBarStore((s) => s.width)
  const label = useScaleBarStore((s) => s.label)

  return (
    <div style={{ position: 'absolute', bottom: 5, left: 16, pointerEvents: 'none', zIndex: 10 }}>
      <div
        style={{
          width,
          height: 6,
          background: 'rgba(255,255,255,0.9)',
          borderLeft: '2px solid black',
          borderRight: '2px solid black',
          borderBottom: '2px solid black',
        }}
      />
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#000' }}>{label}</span>
    </div>
  )
}
