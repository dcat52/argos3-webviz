/**
 * Mock WebSocket server for testing the client without ARGoS.
 * 
 * Run: npx tsx src/mock/server.ts [scene]
 * Scenes: empty, single, swarm, mixed, stress, corridor
 */
import { WebSocketServer, WebSocket } from 'ws'
import { scenes, type Scene } from './scenes'

const sceneName = process.argv[2] || 'swarm'
let currentScene = scenes[sceneName]
if (!currentScene) {
  console.error(`Unknown scene: ${sceneName}`)
  console.error(`Available: ${Object.keys(scenes).join(', ')}`)
  process.exit(1)
}

const PORT = 3000
const BROADCAST_HZ = 10
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' })

let state = 'EXPERIMENT_INITIALIZED'
let step = 0
let running = false

function broadcast() {
  const data = currentScene.generate(step)
  const msg = JSON.stringify({
    type: 'broadcast',
    state,
    steps: step,
    timestamp: Date.now(),
    arena: currentScene.arena,
    entities: data,
    user_data: { available_scenes: Object.keys(scenes), current_scene: Object.keys(scenes).find(k => scenes[k] === currentScene) },
  })
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
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
  broadcast() // send initial state

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
          break
        case 'terminate':
          state = 'EXPERIMENT_DONE'
          running = false
          break
        default:
          // Custom command: switch scene
          if (cmd.command === 'switchScene' && cmd.scene && scenes[cmd.scene]) {
            currentScene = scenes[cmd.scene]
            state = 'EXPERIMENT_INITIALIZED'
            step = 0
            running = false
            console.log(`Switched to scene: ${cmd.scene}`)
          }
          break
      }
      broadcast()
    } catch { /* ignore */ }
  })

  ws.on('close', () => console.log(`Client disconnected (${wss.clients.size} total)`))
})

console.log(`Mock ARGoS WebSocket server on ws://localhost:${PORT}`)
console.log(`Scene: ${sceneName} — ${currentScene.description}`)
console.log(`Arena: ${currentScene.arena.size.x}×${currentScene.arena.size.y}`)
console.log(`Entities: ${currentScene.generate(0).length}`)
