/**
 * Mock WebSocket server for testing the client without ARGoS.
 *
 * Run: npx tsx src/mock/server.ts [scene] [--delta]
 * Scenes: empty, single, swarm, mixed, stress, corridor, stress_500, etc.
 *
 * --delta enables delta encoding: first message is schema, subsequent
 * messages only include entities with changed fields.
 */
import { WebSocketServer, WebSocket } from 'ws'
import { scenes, type Scene } from './scenes'

const args = process.argv.slice(2)
const deltaFlag = args.includes('--delta')
const sceneName = args.find(a => !a.startsWith('--')) || 'swarm'

let currentScene = scenes[sceneName]
if (!currentScene) {
  console.error(`Unknown scene: ${sceneName}`)
  console.error(`Available: ${Object.keys(scenes).join(', ')}`)
  process.exit(1)
}

const PORT = 3000
const BROADCAST_HZ = 10
const KEYFRAME_INTERVAL = 100

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' })

let state = 'EXPERIMENT_INITIALIZED'
let step = 0
let running = false

// Delta state
let prevEntities: Record<string, Record<string, unknown>> = {}
let schemaSent = false
let stepsSinceKeyframe = 0

// Per-client tracking for late joiners
const clientNeedsSchema = new Set<WebSocket>()

function entityToMap(entities: unknown[]): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, unknown>> = {}
  for (const e of entities) {
    const entity = e as Record<string, unknown>
    map[entity.id as string] = entity
  }
  return map
}

function computeDelta(
  current: Record<string, Record<string, unknown>>,
  prev: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const delta: Record<string, Record<string, unknown>> = {}
  for (const [id, entity] of Object.entries(current)) {
    const prevEntity = prev[id]
    if (!prevEntity) {
      delta[id] = entity // new entity — send full
      continue
    }
    const changed: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(entity)) {
      if (key === 'type' || key === 'id') continue
      if (JSON.stringify(val) !== JSON.stringify(prevEntity[key])) {
        changed[key] = val
      }
    }
    if (Object.keys(changed).length > 0) {
      delta[id] = changed
    }
  }
  return delta
}

function buildMessage(entities: unknown[]): string {
  const arena = currentScene.arena
  const userData = { available_scenes: Object.keys(scenes), current_scene: Object.keys(scenes).find(k => scenes[k] === currentScene) }

  if (!deltaFlag) {
    return JSON.stringify({ type: 'broadcast', state, steps: step, timestamp: Date.now(), arena, entities, user_data: userData })
  }

  const currentMap = entityToMap(entities)

  // Schema: first frame, keyframe interval, or new client needs it
  if (!schemaSent || stepsSinceKeyframe >= KEYFRAME_INTERVAL) {
    schemaSent = true
    stepsSinceKeyframe = 0
    prevEntities = currentMap
    return JSON.stringify({ type: 'schema', state, steps: step, timestamp: Date.now(), arena, entities, user_data: userData })
  }

  // Delta
  stepsSinceKeyframe++
  const delta = computeDelta(currentMap, prevEntities)
  prevEntities = currentMap
  return JSON.stringify({ type: 'delta', state, steps: step, timestamp: Date.now(), arena, entities: delta, user_data: userData })
}

function broadcast() {
  const data = currentScene.generate(step)
  const msg = buildMessage(data)

  wss.clients.forEach((ws) => {
    if (ws.readyState !== WebSocket.OPEN) return

    // Late joiner: send schema instead of whatever the tick produced
    if (deltaFlag && clientNeedsSchema.has(ws)) {
      clientNeedsSchema.delete(ws)
      const schema = JSON.stringify({
        type: 'schema', state, steps: step, timestamp: Date.now(),
        arena: currentScene.arena, entities: data,
        user_data: { available_scenes: Object.keys(scenes), current_scene: Object.keys(scenes).find(k => scenes[k] === currentScene) },
      })
      ws.send(schema)
      return
    }

    ws.send(msg)
  })
}

const FF_MULTIPLIER = 10

function tick() {
  if (running) {
    const stepsPerTick = state === 'EXPERIMENT_FAST_FORWARDING' ? FF_MULTIPLIER : 1
    step += stepsPerTick
    if (step >= (currentScene.maxSteps || Infinity)) {
      state = 'EXPERIMENT_DONE'
      running = false
    }
  }
  broadcast()
}

setInterval(tick, 1000 / BROADCAST_HZ)

wss.on('connection', (ws) => {
  console.log(`Client connected (${wss.clients.size} total)`)

  if (deltaFlag && schemaSent) {
    // Late joiner — mark for schema on next tick
    clientNeedsSchema.add(ws)
  } else {
    broadcast()
  }

  ws.on('message', (raw) => {
    try {
      const cmd = JSON.parse(raw.toString())
      switch (cmd.command) {
        case 'play':
          state = 'EXPERIMENT_PLAYING'
          running = true
          break
        case 'pause':
          state = 'EXPERIMENT_PAUSED'
          running = false
          break
        case 'step':
          state = 'EXPERIMENT_PAUSED'
          running = false
          step++
          break
        case 'fastforward':
          state = 'EXPERIMENT_FAST_FORWARDING'
          running = true
          break
        case 'reset':
          state = 'EXPERIMENT_INITIALIZED'
          step = 0
          running = false
          schemaSent = false
          stepsSinceKeyframe = 0
          prevEntities = {}
          break
        case 'terminate':
          state = 'EXPERIMENT_DONE'
          running = false
          break
        default:
          if (cmd.command === 'switchScene' && cmd.scene && scenes[cmd.scene]) {
            currentScene = scenes[cmd.scene]
            state = 'EXPERIMENT_INITIALIZED'
            step = 0
            running = false
            schemaSent = false
            stepsSinceKeyframe = 0
            prevEntities = {}
            console.log(`Switched to scene: ${cmd.scene}`)
          }
          break
      }
      broadcast()
    } catch { /* ignore */ }
  })

  ws.on('close', () => {
    clientNeedsSchema.delete(ws)
    console.log(`Client disconnected (${wss.clients.size} total)`)
  })
})

console.log(`Mock ARGoS WebSocket server on ws://localhost:${PORT}`)
console.log(`Scene: ${sceneName} — ${currentScene.description}`)
console.log(`Mode: ${deltaFlag ? 'delta (keyframe every ' + KEYFRAME_INTERVAL + ' steps)' : 'full broadcast'}`)
console.log(`Arena: ${currentScene.arena.size.x}×${currentScene.arena.size.y}`)
console.log(`Entities: ${currentScene.generate(0).length}`)
