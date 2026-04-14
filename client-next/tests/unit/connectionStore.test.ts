import { describe, test, expect } from 'vitest'
import { useConnectionStore } from '@/stores/connectionStore'

describe('connectionStore', () => {
  test('initial state is disconnected', () => {
    expect(useConnectionStore.getState().status).toBe('disconnected')
  })

  test('has all command methods', () => {
    const s = useConnectionStore.getState()
    expect(typeof s.play).toBe('function')
    expect(typeof s.pause).toBe('function')
    expect(typeof s.step).toBe('function')
    expect(typeof s.reset).toBe('function')
    expect(typeof s.fastForward).toBe('function')
    expect(typeof s.moveEntity).toBe('function')
  })
})
