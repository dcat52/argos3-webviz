import { describe, test, expect, beforeEach } from 'vitest'
import { useExperimentStore } from '@/stores/experimentStore'
import { makeEntity, makeBroadcast, makeSchema, makeDelta } from '../helpers'

beforeEach(() => {
  useExperimentStore.setState(useExperimentStore.getInitialState())
})

describe('applyBroadcast', () => {
  test('sets entities from array', () => {
    useExperimentStore.getState().applyBroadcast(makeBroadcast([makeEntity('r0', 1, 2)]))
    const e = useExperimentStore.getState().entities.get('r0')
    expect(e?.position).toEqual({ x: 1, y: 2, z: 0 })
  })

  test('replaces all entities on each call', () => {
    useExperimentStore.getState().applyBroadcast(makeBroadcast([makeEntity('r0'), makeEntity('r1')]))
    useExperimentStore.getState().applyBroadcast(makeBroadcast([makeEntity('r2')]))
    const { entities } = useExperimentStore.getState()
    expect(entities.size).toBe(1)
    expect(entities.has('r0')).toBe(false)
    expect(entities.has('r2')).toBe(true)
  })

  test('updates steps and state', () => {
    useExperimentStore.getState().applyBroadcast(makeBroadcast([], 42))
    expect(useExperimentStore.getState().steps).toBe(42)
  })
})

describe('applySchema', () => {
  test('sets arena and entities', () => {
    useExperimentStore.getState().applySchema(makeSchema([makeEntity('r0', 5, 5)]))
    const { arena, entities } = useExperimentStore.getState()
    expect(arena?.size.x).toBe(10)
    expect(entities.get('r0')?.position.x).toBe(5)
  })
})

describe('applyDelta', () => {
  test('merges changed fields into existing entity', () => {
    useExperimentStore.getState().applyBroadcast(makeBroadcast([makeEntity('r0', 0, 0, ['0xff0000'])]))
    useExperimentStore.getState().applyDelta(makeDelta({ r0: { position: { x: 3, y: 4, z: 0 } } as Partial<any> }))
    const e = useExperimentStore.getState().entities.get('r0')
    expect(e?.position).toEqual({ x: 3, y: 4, z: 0 })
    // LEDs should be preserved from original
    expect((e as any)?.leds).toEqual(['0xff0000'])
  })

  test('adds new entity from delta', () => {
    useExperimentStore.getState().applyBroadcast(makeBroadcast([]))
    useExperimentStore.getState().applyDelta(makeDelta({ r_new: makeEntity('r_new', 7, 8) as any }))
    expect(useExperimentStore.getState().entities.has('r_new')).toBe(true)
  })
})

describe('applyMessage', () => {
  test('routes broadcast correctly', () => {
    useExperimentStore.getState().applyMessage(makeBroadcast([makeEntity('r0')]))
    expect(useExperimentStore.getState().entities.has('r0')).toBe(true)
  })

  test('routes delta correctly', () => {
    useExperimentStore.getState().applyBroadcast(makeBroadcast([makeEntity('r0')]))
    useExperimentStore.getState().applyMessage(makeDelta({ r0: { position: { x: 9, y: 9, z: 0 } } as any }))
    expect(useExperimentStore.getState().entities.get('r0')?.position.x).toBe(9)
  })
})
