/**
 * Client-side computed fields derived from broadcast data.
 * These appear in viz config field selectors alongside server-provided fields.
 * All computed field names are prefixed with `_`.
 *
 * Fields are computed lazily — only fields in the `activeFields` set are evaluated.
 */
import type { AnyEntity, ArenaInfo, Vec3 } from '@/types/protocol'
import type { VizConfig } from '@/stores/vizConfigStore'
import { SpatialHash } from './spatialHash'

export interface ComputeContext {
  entity: AnyEntity
  prevPosition: Vec3 | undefined
  allEntities: Map<string, AnyEntity>
  arena: ArenaInfo | null
  spatialHash: SpatialHash | null
}

export interface ComputedFieldDef {
  name: string
  type: 'number' | 'string' | 'boolean'
  description: string
  needsSpatialHash?: boolean
  compute: (ctx: ComputeContext) => unknown
}

function pos(e: AnyEntity) {
  return 'position' in e ? e.position : null
}

function leds(e: AnyEntity): string[] {
  return 'leds' in e ? (e as any).leds ?? [] : []
}

export const builtinFields: ComputedFieldDef[] = [
  {
    name: '_speed',
    type: 'number',
    description: 'Movement speed (units/tick)',
    compute: ({ entity, prevPosition }) => {
      const p = pos(entity)
      if (!p || !prevPosition) return 0
      const dx = p.x - prevPosition.x, dy = p.y - prevPosition.y
      return Math.sqrt(dx * dx + dy * dy)
    },
  },
  {
    name: '_heading',
    type: 'number',
    description: 'Movement heading (radians)',
    compute: ({ entity, prevPosition }) => {
      const p = pos(entity)
      if (!p || !prevPosition) return 0
      return Math.atan2(p.y - prevPosition.y, p.x - prevPosition.x)
    },
  },
  {
    name: '_distance_to_center',
    type: 'number',
    description: 'Distance to arena center',
    compute: ({ entity, arena }) => {
      const p = pos(entity)
      if (!p || !arena) return 0
      const dx = p.x - arena.center.x, dy = p.y - arena.center.y
      return Math.sqrt(dx * dx + dy * dy)
    },
  },
  {
    name: '_distance_to_nearest',
    type: 'number',
    description: 'Distance to nearest other entity',
    needsSpatialHash: true,
    compute: ({ entity, allEntities, spatialHash }) => {
      const p = pos(entity)
      if (!p) return 0
      let min = Infinity

      // Use spatial hash if available, with expanding search
      if (spatialHash) {
        for (const radius of [2, 5, Infinity]) {
          const candidates = radius === Infinity
            ? [...allEntities.keys()]
            : spatialHash.queryRadius(p.x, p.y, radius)
          for (const id of candidates) {
            if (id === entity.id) continue
            const other = allEntities.get(id)
            const op = other && pos(other)
            if (!op) continue
            const dx = p.x - op.x, dy = p.y - op.y
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < min) min = d
          }
          if (min < Infinity) break
        }
      } else {
        for (const other of allEntities.values()) {
          if (other.id === entity.id) continue
          const op = pos(other)
          if (!op) continue
          const dx = p.x - op.x, dy = p.y - op.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < min) min = d
        }
      }
      return min === Infinity ? 0 : min
    },
  },
  {
    name: '_neighbor_count',
    type: 'number',
    description: 'Entities within 1m radius',
    needsSpatialHash: true,
    compute: ({ entity, allEntities, spatialHash }) => {
      const p = pos(entity)
      if (!p) return 0
      let count = 0
      const candidates = spatialHash
        ? spatialHash.queryRadius(p.x, p.y, 1.0)
        : [...allEntities.keys()]
      for (const id of candidates) {
        if (id === entity.id) continue
        const other = allEntities.get(id)
        const op = other && pos(other)
        if (!op) continue
        const dx = p.x - op.x, dy = p.y - op.y
        if (dx * dx + dy * dy <= 1) count++
      }
      return count
    },
  },
  {
    name: '_led_state',
    type: 'string',
    description: 'Dominant LED color',
    compute: ({ entity }) => {
      const l = leds(entity)
      if (l.length === 0) return 'none'
      const nonBlack = l.filter(c => c !== '0x000000' && c !== 'black')
      return nonBlack.length > 0 ? nonBlack[0] : 'black'
    },
  },
  {
    name: '_led_changed',
    type: 'boolean',
    description: 'LED color changed since last frame',
    compute: ({ entity }) => {
      // Simplified: without full prev entity, always false.
      // Enable by storing prevLeds when this field is active.
      return false
    },
  },
]

const EMPTY_MAP = new Map<string, Record<string, unknown>>()

/** Extract the set of computed field names actively used by viz config */
export function getActiveComputedFields(config: VizConfig): Set<string> {
  const active = new Set<string>()
  if (config.colorBy?.enabled && config.colorBy.field.startsWith('_'))
    active.add(config.colorBy.field)
  for (const label of config.labels) {
    if (label.enabled && label.field.startsWith('_'))
      active.add(label.field)
  }
  return active
}

/** Compute fields for all entities. Only computes fields in activeFields. */
export function computeFields(
  entities: Map<string, AnyEntity>,
  prevPositions: Map<string, Vec3>,
  arena: ArenaInfo | null,
  activeFields?: Set<string>,
): Map<string, Record<string, unknown>> {
  if (!activeFields || activeFields.size === 0) return EMPTY_MAP

  const needed = builtinFields.filter(f => activeFields.has(f.name))
  if (needed.length === 0) return EMPTY_MAP

  // Build spatial hash if any needed field requires it
  let spatialHash: SpatialHash | null = null
  if (needed.some(f => f.needsSpatialHash)) {
    spatialHash = new SpatialHash(1.0)
    const positions = new Map<string, { x: number; y: number }>()
    for (const [id, e] of entities) {
      if ('position' in e) positions.set(id, e.position)
    }
    spatialHash.rebuild(positions)
  }

  const results = new Map<string, Record<string, unknown>>()
  for (const [id, entity] of entities) {
    const ctx: ComputeContext = {
      entity,
      prevPosition: prevPositions.get(id),
      allEntities: entities,
      arena,
      spatialHash,
    }
    const fields: Record<string, unknown> = {}
    for (const def of needed) {
      fields[def.name] = def.compute(ctx)
    }
    results.set(id, fields)
  }

  return results
}
