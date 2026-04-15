import { describe, test, expect } from 'vitest'
import { vizPresets, getAvailablePresets } from '@/lib/vizPresets'

describe('vizPresets', () => {
  test('has at least 5 presets', () => {
    expect(vizPresets.length).toBeGreaterThanOrEqual(5)
  })

  test('all presets have required fields', () => {
    for (const p of vizPresets) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.config).toBeDefined()
      expect(p.config.trails).toBeDefined()
      expect(p.config.heatmap).toBeDefined()
    }
  })

  test('getAvailablePresets filters by discovered fields', () => {
    const all = getAvailablePresets(['key_count', 'total_keys', 'neighbors', 'has_beacon', 'has_food'])
    expect(all.length).toBe(vizPresets.length) // all fields present

    const noFields = getAvailablePresets([])
    // Only presets with no required fields
    expect(noFields.every(p => p.requiredFields.length === 0)).toBe(true)
  })

  test('none preset clears all viz', () => {
    const none = vizPresets.find(p => p.id === 'none')!
    expect(none.config.colorBy).toBeNull()
    expect(none.config.links).toBeNull()
    expect(none.config.trails.enabled).toBe(false)
    expect(none.config.heatmap.enabled).toBe(false)
  })
})
