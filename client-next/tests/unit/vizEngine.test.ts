import { describe, test, expect } from 'vitest'
import { discoverFields } from '@/lib/vizEngine'
import { makeEntity } from '../helpers'
import type { AnyEntity } from '@/types/protocol'

describe('discoverFields', () => {
  test('finds user_data fields with correct types', () => {
    const entities = new Map<string, AnyEntity>([
      ['r0', { ...makeEntity('r0'), user_data: { battery: 0.8, state: 'idle', active: true } } as AnyEntity],
    ])
    const fields = discoverFields(entities)
    expect(fields).toContainEqual(expect.objectContaining({ fieldName: 'battery', type: 'number' }))
    expect(fields).toContainEqual(expect.objectContaining({ fieldName: 'state', type: 'string' }))
    expect(fields).toContainEqual(expect.objectContaining({ fieldName: 'active', type: 'boolean' }))
  })

  test('skips _prefixed fields', () => {
    const entities = new Map<string, AnyEntity>([
      ['r0', { ...makeEntity('r0'), user_data: { _internal: 1, visible: 2 } } as AnyEntity],
    ])
    const fields = discoverFields(entities)
    expect(fields.find(f => f.fieldName === '_internal')).toBeUndefined()
    expect(fields.find(f => f.fieldName === 'visible')).toBeDefined()
  })

  test('returns no server fields for entities without user_data', () => {
    const entities = new Map<string, AnyEntity>([['r0', makeEntity('r0')]])
    const fields = discoverFields(entities)
    // Only computed fields, no server-provided fields
    expect(fields.every(f => f.computed)).toBe(true)
  })

  test('collects sample values', () => {
    const entities = new Map<string, AnyEntity>([
      ['r0', { ...makeEntity('r0'), user_data: { score: 10 } } as AnyEntity],
      ['r1', { ...makeEntity('r1'), user_data: { score: 20 } } as AnyEntity],
    ])
    const fields = discoverFields(entities)
    const scoreField = fields.find(f => f.fieldName === 'score')
    expect(scoreField?.sampleValues).toContain(10)
    expect(scoreField?.sampleValues).toContain(20)
  })
})
