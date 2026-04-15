import { describe, test, expect, beforeEach } from 'vitest'
import { useExperimentStore } from '@/stores/experimentStore'
import { makeBroadcast, makeEntity } from '../helpers'
import type { DrawCommand } from '@/types/protocol'

beforeEach(() => {
  useExperimentStore.setState(useExperimentStore.getInitialState())
})

describe('draw command extraction', () => {
  test('extracts _draw from user_data', () => {
    const cmds: DrawCommand[] = [
      { shape: 'circle', pos: [1, 2, 0], radius: 1.5, color: [255, 0, 0, 128], fill: true },
    ]
    const msg = makeBroadcast([makeEntity('r0')])
    msg.user_data = { _draw: cmds }
    useExperimentStore.getState().applyBroadcast(msg)
    expect(useExperimentStore.getState().drawCommands).toHaveLength(1)
    expect(useExperimentStore.getState().drawCommands[0].shape).toBe('circle')
  })

  test('returns empty array when no _draw', () => {
    const msg = makeBroadcast([makeEntity('r0')])
    useExperimentStore.getState().applyBroadcast(msg)
    expect(useExperimentStore.getState().drawCommands).toHaveLength(0)
  })

  test('skips malformed draw commands', () => {
    const msg = makeBroadcast([makeEntity('r0')])
    msg.user_data = { _draw: [{ invalid: true }, { shape: 'circle', pos: [0, 0, 0], radius: 1, color: [0, 0, 0, 255], fill: true }] }
    useExperimentStore.getState().applyBroadcast(msg)
    // Only the valid one passes (has 'shape' key)
    expect(useExperimentStore.getState().drawCommands).toHaveLength(1)
  })

  test('extracts _floor from user_data', () => {
    const msg = makeBroadcast([makeEntity('r0')])
    msg.user_data = { _floor: { resolution: 4, origin: [0, 0], size: [10, 10], colors: 'AAAA' } }
    useExperimentStore.getState().applyBroadcast(msg)
    expect(useExperimentStore.getState().floorData).not.toBeNull()
    expect(useExperimentStore.getState().floorData?.resolution).toBe(4)
  })

  test('floorData is null when no _floor', () => {
    const msg = makeBroadcast([makeEntity('r0')])
    useExperimentStore.getState().applyBroadcast(msg)
    expect(useExperimentStore.getState().floorData).toBeNull()
  })
})
