import { type Scene, kheperaiv, footbot, box, cylinder, light, walls, randomWalk, circularMotion, hslLed, ledColor, type ArenaInfo } from './helpers'

/** Arena = walled region + 1m padding on each side */
function arena(wallW: number, wallH: number): ArenaInfo {
  return { size: { x: wallW + 2, y: wallH + 2, z: 1 }, center: { x: 0, y: 0, z: 0.5 } }
}

// ============================================================
// Scene 1: Empty Arena — just walls, no robots
// Tests: arena rendering, grid, camera, walls
// ============================================================
const empty: Scene = {
  description: 'Empty 10×10 arena with walls only',
  arena: arena(10, 10),
  generate: () => [...walls(10, 10)],
}

// ============================================================
// Scene 2: Single Robot — one KheperaIV, stationary
// Tests: entity rendering, selection, inspector, LED colors
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
// Tests: many entities, motion updates, performance
// ============================================================
const swarmState: { x: number; y: number; angle: number }[] = []
for (let i = 0; i < 20; i++) {
  swarmState.push({
    x: (Math.random() - 0.5) * 8,
    y: (Math.random() - 0.5) * 8,
    angle: Math.random() * Math.PI * 2,
  })
}

const swarm: Scene = {
  description: '20 KheperaIVs random walk in 10×10 arena',
  arena: arena(10, 10),
  generate: (step) => {
    const entities: unknown[] = [...walls(10, 10)]
    for (let i = 0; i < swarmState.length; i++) {
      const s = swarmState[i]
      const next = randomWalk(s.x, s.y, s.angle, 0.5, 4.8)
      swarmState[i] = next
      // Color based on heading
      const hue = ((next.angle / Math.PI) * 180 + 360) % 360
      const leds = [hslLed(hue), hslLed(hue), hslLed(hue)]
      entities.push(kheperaiv(`r${i}`, next.x, next.y, next.angle, leds))
    }
    return entities
  },
}

// ============================================================
// Scene 4: Mixed — different entity types together
// Tests: all entity renderers, varied sizes
// ============================================================
const mixed: Scene = {
  description: 'Mixed entities: robots, boxes, cylinders, lights',
  arena: arena(12, 12),
  generate: (step) => {
    const entities: unknown[] = [...walls(12, 12)]

    // 5 KheperaIVs in a circle
    for (let i = 0; i < 5; i++) {
      const m = circularMotion(0, 0, 2, 0.01, step, (i / 5) * Math.PI * 2)
      entities.push(kheperaiv(`kiv_${i}`, m.x, m.y, m.angle, [hslLed(i * 72), hslLed(i * 72), hslLed(i * 72)]))
    }

    // 3 FootBots patrolling
    for (let i = 0; i < 3; i++) {
      const m = circularMotion(0, 0, 4, -0.005, step, (i / 3) * Math.PI * 2)
      const leds = Array(12).fill(0).map((_, j) => hslLed((step * 5 + j * 30) % 360))
      entities.push(footbot(`fb_${i}`, m.x, m.y, m.angle, leds))
    }

    // Obstacle boxes
    entities.push(box('obs_1', 3, 3, 0.5, 0.5, 0.3))
    entities.push(box('obs_2', -3, -2, 1.0, 0.3, 0.2))
    entities.push(box('obs_3', -2, 3, 0.3, 1.0, 0.25))
    entities.push(box('crate_1', 1, -3, 0.4, 0.4, 0.4, true))

    // Cylinders
    entities.push(cylinder('cyl_1', 4, 0, 0.15, 0.3))
    entities.push(cylinder('cyl_2', -4, 1, 0.2, 0.5))

    // Lights
    entities.push(light('light_1', 0, 0, 1.5, '0xffffaa'))
    entities.push(light('light_2', 4, 4, 1.0, '0xff4444'))
    entities.push(light('light_3', -4, -4, 1.0, '0x4444ff'))

    return entities
  },
}

// ============================================================
// Scene 5: Stress Test — 100 robots
// Tests: rendering performance, entity list scrolling
// ============================================================
const stressState: { x: number; y: number; angle: number }[] = []
for (let i = 0; i < 100; i++) {
  stressState.push({
    x: (Math.random() - 0.5) * 18,
    y: (Math.random() - 0.5) * 18,
    angle: Math.random() * Math.PI * 2,
  })
}

const stress: Scene = {
  description: '100 KheperaIVs in 20×20 arena — performance test',
  arena: arena(20, 20),
  generate: (step) => {
    const entities: unknown[] = [...walls(20, 20)]
    for (let i = 0; i < stressState.length; i++) {
      const s = stressState[i]
      const next = randomWalk(s.x, s.y, s.angle, 0.3, 9.5)
      stressState[i] = next
      entities.push(kheperaiv(`r${i}`, next.x, next.y, next.angle))
    }
    return entities
  },
}

// ============================================================
// Scene 6: Corridor — line topology, sync experiment style
// Tests: linear placement, communication visualization
// ============================================================
const corridor: Scene = {
  description: '6 KheperaIVs in a line — sync topology test',
  arena: arena(16, 4),
  generate: (step) => {
    const entities: unknown[] = [
      ...walls(16, 4),
    ]
    const n = 6
    const spacing = 2.5
    const startX = -(n - 1) * spacing / 2

    for (let i = 0; i < n; i++) {
      // Sync progress: robots converge over time
      const progress = Math.min(1, step / 200)
      const syncLevel = i <= Math.floor(progress * n) ? progress : 0
      const r = Math.round(255 * (1 - syncLevel))
      const g = Math.round(255 * syncLevel)
      const color = ledColor(r, g, 0)
      const leds = [color, color, color]

      // User data simulating Canopy sync state
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
// Export all scenes
// ============================================================
export const scenes: Record<string, Scene> = {
  empty,
  single,
  swarm,
  mixed,
  stress,
  corridor,
}
