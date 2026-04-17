import { useRef, useEffect } from 'react'
import { useExperimentStore } from '@/stores/experimentStore'

export type TrailMap = Map<string, [number, number, number][]>

export function useTrailHistory(maxLength: number): TrailMap {
  const entities = useExperimentStore((s) => s.entities)
  const trails = useRef<TrailMap>(new Map())

  useEffect(() => {
    for (const entity of entities.values()) {
      if (!('position' in entity)) continue
      const { x, y, z } = entity.position
      let buf = trails.current.get(entity.id)
      if (!buf) { buf = []; trails.current.set(entity.id, buf) }
      buf.push([x, y, z])
      if (buf.length > maxLength) buf.shift()
    }
    // Remove trails for entities that no longer exist
    for (const id of trails.current.keys()) {
      if (!entities.has(id)) trails.current.delete(id)
    }
  }, [entities, maxLength])

  return trails.current
}
