import type { Vec3 } from '@/types/protocol'

export type DistMethod = 'uniform' | 'gaussian' | 'constant' | 'grid'

/** Simple seedable PRNG (mulberry32) */
function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller transform for gaussian samples */
function gaussianPair(rng: () => number): [number, number] {
  const u1 = rng(), u2 = rng()
  const r = Math.sqrt(-2 * Math.log(u1 || 1e-10))
  return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)]
}

export function generatePositions(
  method: DistMethod,
  params: Record<string, unknown>,
  quantity: number,
  seed?: number
): Vec3[] {
  const rng = mulberry32(seed ?? Date.now())
  switch (method) {
    case 'uniform': return uniformPositions(rng, params, quantity)
    case 'gaussian': return gaussianPositions(rng, params, quantity)
    case 'constant': return constantPositions(params, quantity)
    case 'grid': return gridPositions(params, quantity)
  }
}

function vec3(p: unknown, fallback: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  if (!p || typeof p !== 'object') return fallback
  const o = p as Record<string, number>
  return { x: o.x ?? fallback.x, y: o.y ?? fallback.y, z: o.z ?? fallback.z }
}

function uniformPositions(rng: () => number, params: Record<string, unknown>, n: number): Vec3[] {
  const min = vec3(params.min, { x: -2, y: -2, z: 0 })
  const max = vec3(params.max, { x: 2, y: 2, z: 0 })
  return Array.from({ length: n }, () => ({
    x: min.x + rng() * (max.x - min.x),
    y: min.y + rng() * (max.y - min.y),
    z: min.z + rng() * (max.z - min.z),
  }))
}

function gaussianPositions(rng: () => number, params: Record<string, unknown>, n: number): Vec3[] {
  const mean = vec3(params.mean)
  const std = vec3(params.std_dev, { x: 1, y: 1, z: 0 })
  return Array.from({ length: n }, () => {
    const [gx, gy] = gaussianPair(rng)
    const [gz] = gaussianPair(rng)
    return { x: mean.x + gx * std.x, y: mean.y + gy * std.y, z: mean.z + gz * std.z }
  })
}

function constantPositions(params: Record<string, unknown>, n: number): Vec3[] {
  const v = vec3(params.values)
  return Array(n).fill(v)
}

function gridPositions(params: Record<string, unknown>, n: number): Vec3[] {
  const center = vec3(params.center)
  const dist = vec3(params.distances, { x: 0.5, y: 0.5, z: 0 })
  const layout = (params.layout as [number, number, number]) ?? [n, 1, 1]
  const [cols, rows, layers] = layout
  const positions: Vec3[] = []
  for (let l = 0; l < layers && positions.length < n; l++)
    for (let r = 0; r < rows && positions.length < n; r++)
      for (let c = 0; c < cols && positions.length < n; c++)
        positions.push({
          x: center.x + (c - (cols - 1) / 2) * dist.x,
          y: center.y + (r - (rows - 1) / 2) * dist.y,
          z: center.z + (l - (layers - 1) / 2) * dist.z,
        })
  return positions
}
