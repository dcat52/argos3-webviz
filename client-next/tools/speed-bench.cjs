#!/usr/bin/env node
// Benchmark across tick rates and FF speeds
// Requires: experiment running on ws://localhost:3000
const WebSocket = require('ws')
const url = process.argv[2] || 'ws://localhost:3000'
const RATES = [1, 2, 5, 10, 50, 1000]
const DURATION = 5000

function run(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const send = (cmd) => ws.send(JSON.stringify(cmd))
    let steps = 0, collecting = false, startSteps = 0, frames = 0, startTime = 0
    const results = []

    ws.on('error', reject)
    ws.on('message', (raw) => {
      const d = JSON.parse(raw)
      if (d.steps != null) steps = d.steps
      if (collecting) frames++
    })

    ws.on('open', async () => {
      send({ command: 'play' })
      await sleep(500)

      for (const rate of RATES) {
        send({ command: 'pause' })
        await sleep(200)
        if (rate <= 1) send({ command: 'play' })
        else send({ command: 'fastforward', steps: rate })
        await sleep(500)

        startSteps = steps; startTime = Date.now(); frames = 0; collecting = true
        await sleep(DURATION)
        collecting = false

        const elapsed = (Date.now() - startTime) / 1000
        const totalSteps = steps - startSteps
        results.push({ rate, steps: totalSteps, frames, elapsed, sps: totalSteps / elapsed, fps: frames / elapsed })
      }

      send({ command: 'pause' })
      setTimeout(() => { ws.close(); resolve(results) }, 200)
    })
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log(`Connecting to ${url}`)
  console.log(`${DURATION / 1000}s per rate, rates: ${RATES.map(r => r >= 1000 ? '∞' : r + '×').join(', ')}\n`)

  const results = await run(url)
  const baseline = results[0].sps

  console.log('Rate\tSteps\tFrames\tSteps/s\tFPS\tActual×\tNotes')
  console.log('----\t-----\t------\t-------\t---\t-------\t-----')
  for (const r of results) {
    const label = r.rate >= 1000 ? '∞' : r.rate + '×'
    const mult = baseline > 0 ? (r.sps / baseline).toFixed(1) : '—'
    const sleepMs = r.rate <= 1 ? (1000 / r.sps).toFixed(0) + 'ms/step' : 'no sleep'
    console.log(`${label}\t${r.steps}\t${r.frames}\t${r.sps.toFixed(0)}\t${r.fps.toFixed(0)}\t${mult}×\t${sleepMs}`)
  }

  console.log(`\nBaseline (1×): ${baseline.toFixed(1)} steps/s`)
  console.log(`Max throughput: ${results[results.length - 1].sps.toFixed(0)} steps/s`)
  console.log(`Broadcast overhead: ~${(1000 / results[results.length - 1].fps).toFixed(1)}ms per frame`)
  console.log(`Sleep overhead at 1×: ~${(1000 / baseline).toFixed(0)}ms per step (target: ${(1000 / baseline).toFixed(0)}ms)`)
}

main().catch(console.error)
