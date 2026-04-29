#!/usr/bin/env node
/**
 * Spike: measure WebSocket message sizes from webviz.
 * Usage: node spike_ws_measure.js [port] [seconds]
 * 
 * Connects to webviz, captures messages for N seconds,
 * reports size stats.
 */
const WebSocket = require('./client-next/node_modules/ws')
const port = process.argv[2] || 3000
const duration = (process.argv[3] || 10) * 1000

const ws = new WebSocket(`ws://localhost:${port}`)
const stats = { count: 0, totalBytes: 0, minBytes: Infinity, maxBytes: 0, entityDataBytes: 0, globalDataBytes: 0 }

ws.on('open', () => {
  console.log(`Connected to ws://localhost:${port}, measuring for ${duration/1000}s...`)
  setTimeout(() => {
    ws.close()
    report()
  }, duration)
})

ws.on('message', (data) => {
  const size = data.length
  stats.count++
  stats.totalBytes += size
  if (size < stats.minBytes) stats.minBytes = size
  if (size > stats.maxBytes) stats.maxBytes = size

  try {
    const msg = JSON.parse(data)
    if (msg.user_data) {
      stats.globalDataBytes += JSON.stringify(msg.user_data).length
    }
    const entities = msg.entities
    if (entities) {
      const arr = Array.isArray(entities) ? entities : Object.values(entities)
      for (const e of arr) {
        if (e.user_data) stats.entityDataBytes += JSON.stringify(e.user_data).length
      }
    }
  } catch {}
})

ws.on('error', (e) => { console.error('Connection failed:', e.message); process.exit(1) })

function report() {
  const avg = stats.count ? Math.round(stats.totalBytes / stats.count) : 0
  const rate = stats.count / (duration / 1000)
  console.log(`\n=== WebSocket Message Stats ===`)
  console.log(`Messages:        ${stats.count} (${rate.toFixed(1)}/s)`)
  console.log(`Total bytes:     ${(stats.totalBytes / 1024).toFixed(1)} KB`)
  console.log(`Avg msg size:    ${avg} bytes`)
  console.log(`Min/Max:         ${stats.minBytes} / ${stats.maxBytes} bytes`)
  console.log(`Entity user_data: ${(stats.entityDataBytes / 1024).toFixed(1)} KB (${stats.totalBytes ? (stats.entityDataBytes / stats.totalBytes * 100).toFixed(1) : 0}% of total)`)
  console.log(`Global user_data: ${(stats.globalDataBytes / 1024).toFixed(1)} KB (${stats.totalBytes ? (stats.globalDataBytes / stats.totalBytes * 100).toFixed(1) : 0}% of total)`)
  process.exit(0)
}
