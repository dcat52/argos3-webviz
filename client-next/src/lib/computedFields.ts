/**
 * Client-side computed fields derived from broadcast data.
 * These appear in viz config field selectors alongside server-provided fields.
 * All computed field names are prefixed with `_`.
 */
import type { AnyEntity, ArenaInfo } from '@/types/protocol'

export interface ComputeContext {
  entity: AnyEntity
  prevEntity: AnyEntity | undefined
  allEntities: Map<string, AnyEntity>
  arena: ArenaInfo | null
}

export interface ComputedFieldDef {
  name: string
  type: 'number' | 'string' | 'boolean'
  description: string
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
    compute: ({ entity, prevEntity }) => {
      const p = pos(entity), pp = prevEntity ? pos(prevEntity) : null
      if (!p || !pp) return 0
      const dx = p.x - pp.x, dy = p.y - pp.y
      return Math.sqrt(dx * dx + dy * dy)
    },
  },
  {
    name: '_heading',
    type: 'number',
    description: 'Movement heading (radians)',
    compute: ({ entity, prevEntity }) => {
      const p = pos(entity), pp = prevEntity ? pos(prevEntity) : null
      if (!p || !pp) return 0
      return Math.atan2(p.y - pp.y, p.x - pp.x)
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
    compute: ({ entity, allEntities }) => {
      const p = pos(entity)
      if (!p) return Infinity
      let min = Infinity
      for (const other of allEntities.values()) {
        if (other.id === entity.id) continue
        const op = pos(other)
        if (!op) continue
        const dx = p.x - op.x, dy = p.y - op.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < min) min = d
      }
      return min === Infinity ? 0 : min
    },
  },
  {
    name: '_neighbor_count',
    type: 'number',
    description: 'Entities within 1m radius',
    compute: ({ entity, allEntities }) => {
      const p = pos(entity)
      if (!p) return 0
      let count = 0
      for (const other of allEntities.values()) {
        if (other.id === entity.id) continue
        const op = pos(other)
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
      // Find most common non-black LED
      const nonBlack = l.filter(c => c !== '0x000000' && c !== 'black')
      return nonBlack.length > 0 ? nonBlack[0] : 'black'
    },
  },
  {
    name: '_led_changed',
    type: 'boolean',
    description: 'LED color changed since last frame',
    compute: ({ entity, prevEntity }) => {
      const curr = leds(entity), prev = prevEntity ? leds(prevEntity) : []
      if (curr.length !== prev.length) return true
      return curr.some((c, i) => c !== prev[i])
    },
  },
]

/** Compute all built-in fields for all entities */
export function computeFields(
  entities: Map<string, AnyEntity>,
  prevEntities: Map<string, AnyEntity>,
  arena: ArenaInfo | null,
): Map<string, Record<string, unknown>> {
  const results = new Map<string, Record<string, unknown>>()

  for (const [id, entity] of entities) {
    const ctx: ComputeContext = {
      entity,
      prevEntity: prevEntities.get(id),
      allEntities: entities,
      arena,
    }
    const fields: Record<string, unknown> = {}
    for (const def of builtinFields) {
      fields[def.name] = def.compute(ctx)
    }
    results.set(id, fields)
  }

  return results
}
