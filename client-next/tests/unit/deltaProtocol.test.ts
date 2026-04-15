import { describe, test, expect, beforeEach } from 'vitest'
import { useExperimentStore } from '@/stores/experimentStore'
import { makeEntity, makeBroadcast, makeSchema, makeDelta } from '../helpers'

beforeEach(() => {
  useExperimentStore.setState(useExperimentStore.getInitialState())
})

describe('delta protocol flow', () => {
  test('schema → delta → delta preserves full state', () => {
    // Schema: full initial state
    useExperimentStore.getState().applySchema(makeSchema([
      makeEntity('r0', 0, 0, ['0xff0000']),
      makeEntity('r1', 1, 1, ['0x00ff00']),
    ]))
    expect(useExperimentStore.getState().entities.size).toBe(2)

    // Delta: only r0 moved
    useExperimentStore.getState().applyDelta(makeDelta({
      r0: { position: { x: 2, y: 3, z: 0 } } as any,
    }))

    // r0 position updated, LEDs preserved
    const r0 = useExperimentStore.getState().entities.get('r0')
    expect(r0?.position).toEqual({ x: 2, y: 3, z: 0 })
    expect((r0 as any)?.leds).toEqual(['0xff0000'])

    // r1 unchanged
    const r1 = useExperimentStore.getState().entities.get('r1')
    expect(r1?.position).toEqual({ x: 1, y: 1, z: 0 })
  })

  test('empty delta preserves all entities', () => {
    useExperimentStore.getState().applySchema(makeSchema([makeEntity('r0', 5, 5)]))
    useExperimentStore.getState().applyDelta(makeDelta({}))
    expect(useExperimentStore.getState().entities.get('r0')?.position.x).toBe(5)
  })

  test('delta can add new entities', () => {
    useExperimentStore.getState().applySchema(makeSchema([makeEntity('r0')]))
    useExperimentStore.getState().applyDelta(makeDelta({
      r_new: makeEntity('r_new', 9, 9) as any,
    }))
    expect(useExperimentStore.getState().entities.size).toBe(2)
    expect(useExperimentStore.getState().entities.get('r_new')?.position.x).toBe(9)
  })

  test('keyframe (schema) replaces all entities', () => {
    useExperimentStore.getState().applySchema(makeSchema([makeEntity('r0'), makeEntity('r1')]))
    // Keyframe with only r2
    useExperimentStore.getState().applySchema(makeSchema([makeEntity('r2', 3, 3)]))
    expect(useExperimentStore.getState().entities.size).toBe(1)
    expect(useExperimentStore.getState().entities.has('r2')).toBe(true)
  })
})
