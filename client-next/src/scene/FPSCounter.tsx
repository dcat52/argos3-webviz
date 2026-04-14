import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSceneSettingsStore } from '@/stores/sceneSettingsStore'

export function FPSCounter() {
  const show = useSceneSettingsStore((s) => s.showFps)
  const [fps, setFps] = useState(0)
  const frames = useRef(0)
  const last = useRef(performance.now())
  const history = useRef<number[]>([])

  useFrame(() => {
    frames.current++
    const now = performance.now()
    const delta = now - last.current

    // Per-frame FPS for benchmark collection
    if (delta > 0) {
      history.current.push(1000 / (delta / frames.current))
      if (history.current.length > 600) history.current.shift()
      ;(window as any).__fpsHistory = history.current
    }

    if (now - last.current >= 1000) {
      setFps(frames.current)
      frames.current = 0
      last.current = now
    }
  })

  if (!show) return null
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-12 left-2 bg-black/60 text-green-400 text-xs font-mono px-2 py-0.5 rounded">
        {fps} FPS
      </div>
    </Html>
  )
}
