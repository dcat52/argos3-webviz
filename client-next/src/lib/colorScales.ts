import * as THREE from 'three'
import type { AnyEntity } from '@/types/protocol'

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()

export function linearScale(value: number, min: number, max: number, colorA: string, colorB: string): string {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)))
  tmpA.set(colorA)
  tmpB.set(colorB)
  tmpA.lerp(tmpB, t)
  return '#' + tmpA.getHexString()
}

const DEFAULT_PALETTE = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999']

export function categoricalScale(value: string, palette: string[] = DEFAULT_PALETTE): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}

export function computeMinMax(entities: Map<string, AnyEntity>, field: string): [number, number] {
  let min = Infinity, max = -Infinity
  for (const e of entities.values()) {
    const ud = 'user_data' in e ? (e.user_data as Record<string, unknown>) : null
    if (!ud) continue
    const v = ud[field]
    if (typeof v === 'number') { min = Math.min(min, v); max = Math.max(max, v) }
  }
  return min === Infinity ? [0, 1] : [min, max]
}
