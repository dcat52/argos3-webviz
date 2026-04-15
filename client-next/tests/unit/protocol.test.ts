import { describe, test, expect } from 'vitest'
import { isServerMessage } from '@/protocol/guards'

describe('isServerMessage', () => {
  test('accepts valid broadcast', () => {
    expect(isServerMessage({ type: 'broadcast', state: 'EXPERIMENT_PLAYING', steps: 1, timestamp: 0, arena: {}, entities: [] })).toBe(true)
  })

  test('accepts valid schema', () => {
    expect(isServerMessage({ type: 'schema', arena: {}, entities: [] })).toBe(true)
  })

  test('accepts valid delta', () => {
    expect(isServerMessage({ type: 'delta', entities: {} })).toBe(true)
  })

  test('accepts valid event', () => {
    expect(isServerMessage({ type: 'event', event: 'reset', state: 'EXPERIMENT_INITIALIZED' })).toBe(true)
  })

  test('accepts valid log', () => {
    expect(isServerMessage({ type: 'log', timestamp: 0, messages: [] })).toBe(true)
  })

  test('rejects null', () => {
    expect(isServerMessage(null)).toBe(false)
  })

  test('rejects string', () => {
    expect(isServerMessage('hello')).toBe(false)
  })

  test('rejects object without type', () => {
    expect(isServerMessage({ foo: 'bar' })).toBe(false)
  })

  test('rejects unknown type', () => {
    expect(isServerMessage({ type: 'unknown' })).toBe(false)
  })
})
