import { describe, it, expect } from 'vitest'
import { generatePositions } from '@/lib/distribute'

describe('distribute: uniform', () => {
  it('generates correct quantity', () => {
    const positions = generatePositions('uniform', {
      min: { x: -2, y: -2, z: 0 },
      max: { x: 2, y: 2, z: 0 },
    }, 10, 42)
    expect(positions).toHaveLength(10)
  })

  it('positions are within bounds', () => {
    const positions = generatePositions('uniform', {
      min: { x: -1, y: -1, z: 0 },
      max: { x: 1, y: 1, z: 0 },
    }, 100, 42)
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(-1)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.y).toBeGreaterThanOrEqual(-1)
      expect(p.y).toBeLessThanOrEqual(1)
      expect(p.z).toBe(0)
    }
  })

  it('same seed produces same positions', () => {
    const a = generatePositions('uniform', { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }, 5, 123)
    const b = generatePositions('uniform', { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }, 5, 123)
    expect(a).toEqual(b)
  })

  it('different seeds produce different positions', () => {
    const a = generatePositions('uniform', { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }, 5, 1)
    const b = generatePositions('uniform', { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }, 5, 2)
    expect(a).not.toEqual(b)
  })
})

describe('distribute: grid', () => {
  it('generates grid positions', () => {
    const positions = generatePositions('grid', {
      center: { x: 0, y: 0, z: 0 },
      distances: { x: 1, y: 1, z: 0 },
      layout: [3, 2, 1],
    }, 6)
    expect(positions).toHaveLength(6)
  })

  it('grid is centered', () => {
    const positions = generatePositions('grid', {
      center: { x: 0, y: 0, z: 0 },
      distances: { x: 1, y: 1, z: 0 },
      layout: [3, 1, 1],
    }, 3)
    expect(positions[0].x).toBe(-1)
    expect(positions[1].x).toBe(0)
    expect(positions[2].x).toBe(1)
  })

  it('respects quantity limit', () => {
    const positions = generatePositions('grid', {
      center: { x: 0, y: 0, z: 0 },
      distances: { x: 1, y: 1, z: 0 },
      layout: [10, 10, 1],
    }, 5)
    expect(positions).toHaveLength(5)
  })
})

describe('distribute: gaussian', () => {
  it('generates correct quantity', () => {
    const positions = generatePositions('gaussian', {
      mean: { x: 0, y: 0, z: 0 },
      std_dev: { x: 1, y: 1, z: 0 },
    }, 50, 42)
    expect(positions).toHaveLength(50)
  })

  it('positions cluster around mean', () => {
    const positions = generatePositions('gaussian', {
      mean: { x: 5, y: 5, z: 0 },
      std_dev: { x: 0.1, y: 0.1, z: 0 },
    }, 100, 42)
    const avgX = positions.reduce((s, p) => s + p.x, 0) / positions.length
    const avgY = positions.reduce((s, p) => s + p.y, 0) / positions.length
    expect(avgX).toBeCloseTo(5, 0)
    expect(avgY).toBeCloseTo(5, 0)
  })
})

describe('distribute: constant', () => {
  it('all positions are the same', () => {
    const positions = generatePositions('constant', {
      values: { x: 3, y: 4, z: 0 },
    }, 5)
    for (const p of positions) {
      expect(p.x).toBe(3)
      expect(p.y).toBe(4)
      expect(p.z).toBe(0)
    }
  })
})
