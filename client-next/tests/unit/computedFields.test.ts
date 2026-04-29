import { describe, test, expect } from 'vitest'
import { computeFields, builtinFields } from '@/lib/computedFields'
import { makeEntity } from '../helpers'
import type { AnyEntity, Vec3 } from '@/types/protocol'

/** All field names for testing — simulates all fields being active */
const ALL_FIELDS = new Set(builtinFields.map(f => f.name))

/** Extract positions from entity map for prevPositions */
function extractPositions(entities: Map<string, AnyEntity>): Map<string, Vec3> {
  const positions = new Map<string, Vec3>()
  for (const [id, e] of entities) {
    if ('position' in e) positions.set(id, e.position)
  }
  return positions
}

describe('computedFields', () => {
  test('has 7 built-in fields', () => {
    expect(builtinFields.length).toBe(7)
  })

  test('returns empty map when no active fields', () => {
    const entities = new Map([['r0', makeEntity('r0', 1, 2)]])
    const result = computeFields(entities, new Map(), null)
    expect(result.size).toBe(0)
  })

  test('_speed is 0 with no previous frame', () => {
    const entities = new Map([['r0', makeEntity('r0', 1, 2)]])
    const result = computeFields(entities, new Map(), null, ALL_FIELDS)
    expect(result.get('r0')?._speed).toBe(0)
  })

  test('_speed computes distance between frames', () => {
    const prev = new Map([['r0', makeEntity('r0', 0, 0)]])
    const curr = new Map([['r0', makeEntity('r0', 3, 4)]])
    const result = computeFields(curr, extractPositions(prev), null, ALL_FIELDS)
    expect(result.get('r0')?._speed).toBeCloseTo(5)
  })

  test('_distance_to_center uses arena center', () => {
    const entities = new Map([['r0', makeEntity('r0', 3, 4)]])
    const arena = { size: { x: 10, y: 10, z: 1 }, center: { x: 0, y: 0, z: 0.5 } }
    const result = computeFields(entities, new Map(), arena, ALL_FIELDS)
    expect(result.get('r0')?._distance_to_center).toBeCloseTo(5)
  })

  test('_neighbor_count counts entities within 1m', () => {
    const entities = new Map<string, AnyEntity>([
      ['r0', makeEntity('r0', 0, 0)],
      ['r1', makeEntity('r1', 0.5, 0)],  // within 1m
      ['r2', makeEntity('r2', 2, 0)],    // outside 1m
    ])
    const result = computeFields(entities, new Map(), null, ALL_FIELDS)
    expect(result.get('r0')?._neighbor_count).toBe(1)
  })

  test('_led_state returns dominant non-black LED', () => {
    const e = { ...makeEntity('r0', 0, 0, ['0xff0000', '0x000000', '0x000000']) }
    const entities = new Map<string, AnyEntity>([['r0', e]])
    const result = computeFields(entities, new Map(), null, ALL_FIELDS)
    expect(result.get('r0')?._led_state).toBe('0xff0000')
  })

  test('only computes requested fields', () => {
    const entities = new Map([['r0', makeEntity('r0', 1, 2)]])
    const result = computeFields(entities, new Map(), null, new Set(['_speed']))
    const fields = result.get('r0')!
    expect('_speed' in fields).toBe(true)
    expect('_neighbor_count' in fields).toBe(false)
  })
})
