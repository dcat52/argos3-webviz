/** Helpers for building mock entity data matching the ARGoS webviz protocol. */

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }
export interface ArenaInfo { size: Vec3; center: Vec3 }

export interface Scene {
  description: string
  arena: ArenaInfo
  maxSteps?: number
  generate: (step: number) => unknown[]
}

// --- Factories ---

export function kheperaiv(id: string, x: number, y: number, angle = 0, leds = ['0x000000', '0x000000', '0x000000']): unknown {
  const c = Math.cos(angle / 2), s = Math.sin(angle / 2)
  return {
    type: 'kheperaiv', id,
    position: { x, y, z: 0 },
    orientation: { x: 0, y: 0, z: s, w: c },
    leds,
    rays: makeProximityRays(8, 0.1, angle),
    points: [],
  }
}

export function footbot(id: string, x: number, y: number, angle = 0, leds?: string[]): unknown {
  const c = Math.cos(angle / 2), s = Math.sin(angle / 2)
  return {
    type: 'foot-bot', id,
    position: { x, y, z: 0 },
    orientation: { x: 0, y: 0, z: s, w: c },
    leds: leds || Array(12).fill('0x000000'),
    rays: makeProximityRays(24, 0.1, angle),
    points: [],
  }
}

export function box(id: string, x: number, y: number, sx: number, sy: number, sz = 0.2, movable = false): unknown {
  return {
    type: 'box', id, is_movable: movable,
    position: { x, y, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: sx, y: sy, z: sz },
  }
}

export function cylinder(id: string, x: number, y: number, r: number, h: number, movable = false): unknown {
  return {
    type: 'cylinder', id, is_movable: movable,
    position: { x, y, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    radius: r, height: h,
  }
}

export function light(id: string, x: number, y: number, z: number, color = '0xffff00'): unknown {
  return {
    type: 'light', id, color,
    position: { x, y, z },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
  }
}

// --- Walls helper ---

export function walls(arenaW: number, arenaH: number, thickness = 0.1, height = 0.2): unknown[] {
  const hw = arenaW / 2, hh = arenaH / 2
  return [
    box('wall_north', 0, hh + thickness / 2, arenaW, thickness, height),
    box('wall_south', 0, -(hh + thickness / 2), arenaW, thickness, height),
    box('wall_east', hw + thickness / 2, 0, thickness, arenaH, height),
    box('wall_west', -(hw + thickness / 2), 0, thickness, arenaH, height),
  ]
}

// --- Motion helpers ---

export function randomWalk(x: number, y: number, angle: number, speed: number, bounds: number, dt = 0.1, rng: () => number = Math.random): { x: number; y: number; angle: number } {
  let nx = x + Math.cos(angle) * speed * dt
  let ny = y + Math.sin(angle) * speed * dt
  let na = angle + (rng() - 0.5) * 0.3

  // Bounce off walls
  if (Math.abs(nx) > bounds) { na = Math.PI - na; nx = Math.sign(nx) * bounds }
  if (Math.abs(ny) > bounds) { na = -na; ny = Math.sign(ny) * bounds }
  return { x: nx, y: ny, angle: na }
}

export function circularMotion(cx: number, cy: number, radius: number, speed: number, step: number, offset: number): { x: number; y: number; angle: number } {
  const t = (step * speed + offset) % (Math.PI * 2)
  return { x: cx + Math.cos(t) * radius, y: cy + Math.sin(t) * radius, angle: t + Math.PI / 2 }
}

// --- Ray generation ---

function makeProximityRays(count: number, length: number, bodyAngle: number, rng: () => number = Math.random): string[] {
  const rays: string[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const hit = rng() > 0.7
    const dist = hit ? rng() * length : length
    rays.push(`${hit}:0,0,0.03:${(Math.cos(a) * dist).toFixed(4)},${(Math.sin(a) * dist).toFixed(4)},0.03`)
  }
  return rays
}

// --- LED helpers ---

export function ledColor(r: number, g: number, b: number): string {
  return '0x' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function hslLed(h: number, s = 1, l = 0.5): string {
  // Simple HSL to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  return ledColor((r + m) * 255, (g + m) * 255, (b + m) * 255)
}
