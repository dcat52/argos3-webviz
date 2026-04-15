import { describe, test, expect } from 'vitest'
import { parseArgosrec } from '@/protocol/argosrecParser'

function makeFile(content: string, name = 'test.argosrec'): File {
  return new File([content], name, { type: 'application/octet-stream' })
}

const schema = JSON.stringify({
  type: 'schema', step: 0,
  arena: { size: { x: 10, y: 10, z: 1 }, center: { x: 0, y: 0, z: 0.5 } },
  entities: [{ type: 'kheperaiv', id: 'r0', position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, leds: [], rays: [], points: [] }],
})

const delta = JSON.stringify({
  type: 'delta', step: 1,
  entities: { r0: { position: { x: 1, y: 2, z: 0 } } },
})

const header = JSON.stringify({
  type: 'header', version: 2, delta: true, every_n_steps: 1, created: '2026-04-14T00:00:00Z',
})

describe('parseArgosrec', () => {
  test('parses v1 file (no header)', async () => {
    const file = makeFile([schema, delta].join('\n'))
    const result = await parseArgosrec(file)
    expect(result.frames.length).toBe(2)
    expect(result.frames[0].type).toBe('schema')
    expect(result.frames[1].type).toBe('delta')
    expect(result.header.arena?.size.x).toBe(10)
    expect(result.warnings.length).toBe(0)
  })

  test('parses v2 file (with header)', async () => {
    const file = makeFile([header, schema, delta].join('\n'))
    const result = await parseArgosrec(file)
    expect(result.header.version).toBe(2)
    expect(result.header.created).toBe('2026-04-14T00:00:00Z')
    expect(result.frames.length).toBe(2)
  })

  test('handles empty file', async () => {
    const file = makeFile('')
    const result = await parseArgosrec(file)
    expect(result.frames.length).toBe(0)
    expect(result.warnings).toContain('File is empty.')
  })

  test('handles corrupted lines gracefully', async () => {
    const file = makeFile([schema, 'not json', delta].join('\n'))
    const result = await parseArgosrec(file)
    expect(result.frames.length).toBe(2)
    expect(result.warnings[0]).toContain('1 line(s) could not be parsed')
  })

  test('parses full/broadcast frames', async () => {
    const full = JSON.stringify({ type: 'full', step: 1, state: 'EXPERIMENT_PLAYING', entities: [], arena: { size: { x: 5, y: 5, z: 1 }, center: { x: 0, y: 0, z: 0.5 } } })
    const file = makeFile([schema, full].join('\n'))
    const result = await parseArgosrec(file)
    expect(result.frames[1].type).toBe('full')
  })
})
