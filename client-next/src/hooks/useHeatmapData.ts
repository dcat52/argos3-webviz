import { useRef, useEffect } from 'react'
import { useExperimentStore } from '@/stores/experimentStore'

export function useHeatmapData(resolution: number, decay: number) {
  const entities = useExperimentStore((s) => s.entities)
  const arena = useExperimentStore((s) => s.arena)
  const grid = useRef<Float32Array>(new Float32Array(resolution * resolution))

  useEffect(() => {
    if (!arena) return
    const g = grid.current
    if (g.length !== resolution * resolution) {
      grid.current = new Float32Array(resolution * resolution)
    }
    // Decay
    for (let i = 0; i < g.length; i++) g[i] *= decay

    const { size, center } = arena
    const hw = size.x / 2, hh = size.y / 2

    for (const entity of entities.values()) {
      if (!('position' in entity)) continue
      const nx = (entity.position.x - center.x + hw) / size.x
      const ny = (entity.position.y - center.y + hh) / size.y
      const gx = Math.floor(nx * resolution)
      const gy = Math.floor(ny * resolution)
      if (gx >= 0 && gx < resolution && gy >= 0 && gy < resolution) {
        g[gy * resolution + gx] = Math.min(1, g[gy * resolution + gx] + 0.1)
      }
    }
  }, [entities, arena, resolution, decay])

  return { grid: grid.current, arena }
}
