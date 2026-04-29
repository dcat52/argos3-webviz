import { useRef } from 'react'
import { useExperimentStore } from '@/stores/experimentStore'
import { RingBuffer } from '@/lib/ringBuffer'

export type TrailMap = Map<string, RingBuffer<[number, number, number]>>

export function useTrailHistory(maxLength: number): TrailMap {
  const entities = useExperimentStore((s) => s.entities)
  const trails = useRef<TrailMap>(new Map())

  for (const entity of entities.values()) {
    if (!('position' in entity)) continue
    const { x, y, z } = entity.position
    let buf = trails.current.get(entity.id)
    if (!buf) {
      buf = new RingBuffer(maxLength)
      trails.current.set(entity.id, buf)
    }
    const last = buf.last()
    if (!last || last[0] !== x || last[1] !== y || last[2] !== z) {
      buf.push([x, y, z])
    }
  }
  // Clean up removed entities
  for (const id of trails.current.keys()) {
    if (!entities.has(id)) trails.current.delete(id)
  }

  return trails.current
}
