import { type Scene, kheperaiv, footbot, box, cylinder, light, walls, randomWalk, circularMotion, hslLed, ledColor, type ArenaInfo } from './helpers'
import { mulberry32 } from './rng'

/** Arena = walled region + 1m padding on each side */
function arena(wallW: number, wallH: number): ArenaInfo {
  return { size: { x: wallW + 2, y: wallH + 2, z: 1 }, center: { x: 0, y: 0, z: 0.5 } }
}

/** Generate N initial robot positions from a seeded RNG */
function initPositions(n: number, bounds: number, seed: number) {
  const rng = mulberry32(seed)
  return Array.from({ length: n }, () => ({
    x: (rng() - 0.5) * bounds * 2,
    y: (rng() - 0.5) * bounds * 2,
    angle: rng() * Math.PI * 2,
  }))
}

// Shared RNG for per-tick randomness (reset per server start via seed)
const tickRng = mulberry32(123)

// ============================================================
// Scene 1: Empty Arena — just walls, no robots
// ============================================================
const empty: Scene = {
  description: 'Empty 10×10 arena with walls only',
  arena: arena(10, 10),
  generate: () => [...walls(10, 10)],
}

// ============================================================
// Scene 2: Single Robot — one KheperaIV, stationary
// ============================================================
const single: Scene = {
  description: 'Single KheperaIV at origin with cycling LEDs',
  arena: arena(4, 4),
  generate: (step) => {
    const hue = (step * 3) % 360
    const leds = [hslLed(hue), hslLed((hue + 120) % 360), hslLed((hue + 240) % 360)]
    return [
      ...walls(4, 4),
      kheperaiv('kiv_0', 0, 0, step * 0.02, leds),
    ]
  },
}

// ============================================================
// Scene 3: Swarm — 20 KheperaIVs doing random walk
// ============================================================
const swarmState = initPositions(20, 4, 42)

const swarm: Scene = {
  description: '20 KheperaIVs random walk in 10×10 arena',
  arena: arena(10, 10),
  generate: (step) => {
    const entities: unknown[] = [...walls(10, 10)]
    for (let i = 0; i < swarmState.length; i++) {
      const s = swarmState[i]
      const next = randomWalk(s.x, s.y, s.angle, 0.5, 4.8, 0.1, tickRng)
      swarmState[i] = next
      const hue = ((next.angle / Math.PI) * 180 + 360) % 360
      const leds = [hslLed(hue), hslLed(hue), hslLed(hue)]
      entities.push(kheperaiv(`r${i}`, next.x, next.y, next.angle, leds))
    }
    return entities
  },
}

// ============================================================
// Scene 4: Mixed — different entity types together
// ============================================================
const mixed: Scene = {
  description: 'Mixed entities: robots, boxes, cylinders, lights',
  arena: arena(12, 12),
  generate: (step) => {
    const entities: unknown[] = [...walls(12, 12)]
    for (let i = 0; i < 5; i++) {
      const m = circularMotion(0, 0, 2, 0.01, step, (i / 5) * Math.PI * 2)
      entities.push(kheperaiv(`kiv_${i}`, m.x, m.y, m.angle, [hslLed(i * 72), hslLed(i * 72), hslLed(i * 72)]))
    }
    for (let i = 0; i < 3; i++) {
      const m = circularMotion(0, 0, 4, -0.005, step, (i / 3) * Math.PI * 2)
      const leds = Array(12).fill(0).map((_, j) => hslLed((step * 5 + j * 30) % 360))
      entities.push(footbot(`fb_${i}`, m.x, m.y, m.angle, leds))
    }
    entities.push(box('obs_1', 3, 3, 0.5, 0.5, 0.3))
    entities.push(box('obs_2', -3, -2, 1.0, 0.3, 0.2))
    entities.push(box('obs_3', -2, 3, 0.3, 1.0, 0.25))
    entities.push(box('crate_1', 1, -3, 0.4, 0.4, 0.4, true))
    entities.push(cylinder('cyl_1', 4, 0, 0.15, 0.3))
    entities.push(cylinder('cyl_2', -4, 1, 0.2, 0.5))
    entities.push(light('light_1', 0, 0, 1.5, '0xffffaa'))
    entities.push(light('light_2', 4, 4, 1.0, '0xff4444'))
    entities.push(light('light_3', -4, -4, 1.0, '0x4444ff'))
    return entities
  },
}

// ============================================================
// Scene 5: Stress Test — 100 robots
// ============================================================
const stressState = initPositions(100, 9, 99)

const stress: Scene = {
  description: '100 KheperaIVs in 20×20 arena — performance test',
  arena: arena(20, 20),
  generate: (step) => {
    const entities: unknown[] = [...walls(20, 20)]
    for (let i = 0; i < stressState.length; i++) {
      const s = stressState[i]
      const next = randomWalk(s.x, s.y, s.angle, 0.3, 9.5, 0.1, tickRng)
      stressState[i] = next
      entities.push(kheperaiv(`r${i}`, next.x, next.y, next.angle))
    }
    return entities
  },
}

// ============================================================
// Scene 6: Corridor — line topology, sync experiment style
// ============================================================
const corridor: Scene = {
  description: '6 KheperaIVs in a line — sync topology test',
  arena: arena(16, 4),
  generate: (step) => {
    const entities: unknown[] = [...walls(16, 4)]
    const n = 6
    const spacing = 2.5
    const startX = -(n - 1) * spacing / 2
    for (let i = 0; i < n; i++) {
      const progress = Math.min(1, step / 200)
      const syncLevel = i <= Math.floor(progress * n) ? progress : 0
      const r = Math.round(255 * (1 - syncLevel))
      const g = Math.round(255 * syncLevel)
      const color = ledColor(r, g, 0)
      const leds = [color, color, color]
      const userData = {
        key_count: Math.floor(syncLevel * 10),
        total_keys: 10,
        root_hash: syncLevel >= 1 ? 'a1b2c3d4' : `${i}f${i}e${i}d`,
        neighbors: [i > 0 ? `r${i - 1}` : null, i < n - 1 ? `r${i + 1}` : null].filter(Boolean),
      }
      const e = kheperaiv(`r${i}`, startX + i * spacing, 0, 0, leds) as Record<string, unknown>
      e.user_data = userData
      entities.push(e)
    }
    return entities
  },
  maxSteps: 300,
}

// ============================================================
// Scene 7: Stress 500 — scalability ceiling
// ============================================================
const stress500State = initPositions(500, 19, 500)

const stress_500: Scene = {
  description: '500 KheperaIVs in 40×40 arena — scalability test',
  arena: arena(40, 40),
  generate: (step) => {
    const entities: unknown[] = [...walls(40, 40)]
    for (let i = 0; i < stress500State.length; i++) {
      const s = stress500State[i]
      const next = randomWalk(s.x, s.y, s.angle, 0.2, 19, 0.1, tickRng)
      stress500State[i] = next
      entities.push(kheperaiv(`r${i}`, next.x, next.y, next.angle))
    }
    return entities
  },
}

// ============================================================
// Scene 8: Delta stationary — 20 robots, no movement
// ============================================================
const staticPositions = initPositions(20, 4, 77)

const delta_stationary: Scene = {
  description: '20 KheperaIVs, stationary — delta efficiency baseline',
  arena: arena(10, 10),
  generate: () => {
    const entities: unknown[] = [...walls(10, 10)]
    for (let i = 0; i < staticPositions.length; i++) {
      const s = staticPositions[i]
      entities.push(kheperaiv(`r${i}`, s.x, s.y, s.angle))
    }
    return entities
  },
}

// ============================================================
// Scene 9: Delta partial — 20 robots, 2 moving
// ============================================================
const partialState = initPositions(20, 4, 88)

const delta_partial: Scene = {
  description: '20 KheperaIVs, 2 moving — partial delta test',
  arena: arena(10, 10),
  generate: (step) => {
    const entities: unknown[] = [...walls(10, 10)]
    for (let i = 0; i < partialState.length; i++) {
      const s = partialState[i]
      if (i < 2) {
        const next = randomWalk(s.x, s.y, s.angle, 0.5, 4.8, 0.1, tickRng)
        partialState[i] = next
      }
      entities.push(kheperaiv(`r${i}`, s.x, s.y, s.angle))
    }
    return entities
  },
}

// ============================================================
// Scene 10: Recording benchmark — 1000 steps then stop
// ============================================================
const rec1kState = initPositions(20, 4, 1000)

const recording_1k: Scene = {
  description: '20 KheperaIVs, 1000 steps — recording benchmark',
  arena: arena(10, 10),
  maxSteps: 1000,
  generate: (step) => {
    const entities: unknown[] = [...walls(10, 10)]
    for (let i = 0; i < rec1kState.length; i++) {
      const s = rec1kState[i]
      const next = randomWalk(s.x, s.y, s.angle, 0.5, 4.8, 0.1, tickRng)
      rec1kState[i] = next
      entities.push(kheperaiv(`r${i}`, next.x, next.y, next.angle))
    }
    return entities
  },
}

// ============================================================
// Export all scenes
// ============================================================
export const scenes: Record<string, Scene> = {
  empty,
  single,
  swarm,
  mixed,
  stress,
  corridor,
  stress_500,
  delta_stationary,
  delta_partial,
  recording_1k,
}
