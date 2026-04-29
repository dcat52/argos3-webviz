import { useRef, useEffect, useState } from 'react'
import { Line } from '@react-three/drei'
import { useVizConfigStore } from '@/stores/vizConfigStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { RingBuffer } from '@/lib/ringBuffer'

export function TrailRenderer() {
  const config = useVizConfigStore((s) => s.config.trails)
  const entities = useExperimentStore((s) => s.entities)
  const buf = useRef<Map<string, RingBuffer<[number, number, number]>>>(new Map())
  const [render, setRender] = useState(0)

  useEffect(() => {
    let changed = false
    for (const entity of entities.values()) {
      if (!('position' in entity)) continue
      const { x, y, z } = entity.position
      let trail = buf.current.get(entity.id)
      if (!trail) { trail = new RingBuffer(config.length); buf.current.set(entity.id, trail) }
      const last = trail.last()
      if (!last || last[0] !== x || last[1] !== y || last[2] !== z) {
        trail.push([x, y, z])
        changed = true
      }
    }
    for (const id of buf.current.keys()) {
      if (!entities.has(id)) { buf.current.delete(id); changed = true }
    }
    if (changed) setRender((r) => r + 1)
  }, [entities, config.length])

  if (!config.enabled) return null

  return (
    <>
      {Array.from(buf.current.entries()).map(([id, ring]) => {
        if (ring.length < 2) return null
        const points = [...ring].map(p => [...p] as [number, number, number])
        return (
          <Line
            key={`${id}-${render}`}
            points={points}
            color={useSettingsStore.getState().trailColor}
            lineWidth={1.5}
            transparent
            opacity={config.opacity}
          />
        )
      })}
    </>
  )
}
