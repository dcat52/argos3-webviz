import { useRef } from 'react'
import { useExperimentStore } from '@/stores/experimentStore'

export type TrailMap = Map<string, [number, number, number][]>

export function useTrailHistory(maxLength: number): TrailMap {
  const entities = useExperimentStore((s) => s.entities)
  const trails = useRef<TrailMap>(new Map())

  // Mutate the ref (accumulate points), then return a new Map so React sees a change
  for (const entity of entities.values()) {
    if (!('position' in entity)) continue
    const { x, y, z } = entity.position
    let buf = trails.current.get(entity.id)
    if (!buf) { buf = []; trails.current.set(entity.id, buf) }
    const last = buf[buf.length - 1]
    if (!last || last[0] !== x || last[1] !== y || last[2] !== z) {
      buf.push([x, y, z])
      if (buf.length > maxLength) buf.shift()
    }
  }
  for (const id of trails.current.keys()) {
    if (!entities.has(id)) trails.current.delete(id)
  }

  // Return new Map reference to trigger re-render in consumers
  return new Map(trails.current)
}
