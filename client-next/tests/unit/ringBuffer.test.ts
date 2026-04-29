import { describe, test, expect } from 'vitest'
import { RingBuffer } from '@/lib/ringBuffer'

describe('RingBuffer', () => {
  test('push and iterate within capacity', () => {
    const buf = new RingBuffer<number>(5)
    buf.push(1); buf.push(2); buf.push(3)
    expect(buf.length).toBe(3)
    expect([...buf]).toEqual([1, 2, 3])
  })

  test('wraps around when exceeding capacity', () => {
    const buf = new RingBuffer<number>(3)
    buf.push(1); buf.push(2); buf.push(3); buf.push(4); buf.push(5)
    expect(buf.length).toBe(3)
    expect([...buf]).toEqual([3, 4, 5])
  })

  test('get returns correct item by logical index', () => {
    const buf = new RingBuffer<string>(3)
    buf.push('a'); buf.push('b'); buf.push('c'); buf.push('d')
    expect(buf.get(0)).toBe('b')  // oldest
    expect(buf.get(2)).toBe('d')  // newest
    expect(buf.get(3)).toBeUndefined()
    expect(buf.get(-1)).toBeUndefined()
  })

  test('last returns most recent item', () => {
    const buf = new RingBuffer<number>(3)
    expect(buf.last()).toBeUndefined()
    buf.push(10)
    expect(buf.last()).toBe(10)
    buf.push(20); buf.push(30); buf.push(40)
    expect(buf.last()).toBe(40)
  })

  test('clear resets buffer', () => {
    const buf = new RingBuffer<number>(5)
    buf.push(1); buf.push(2); buf.push(3)
    buf.clear()
    expect(buf.length).toBe(0)
    expect([...buf]).toEqual([])
  })
})
