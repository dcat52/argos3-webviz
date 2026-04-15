/**
 * Parser for .argosrec (JSON-lines) files produced by CWebvizRecorder.
 *
 * Format:
 *   Line 1 (optional): {"type":"header", "version":2, ...}
 *   Line 1 or 2: {"type":"schema", "arena":{...}, "entities":[...]}
 *   Lines N+: {"type":"delta"|"full", "step":N, "entities":...}
 */
import { inflate } from 'pako'
import type { SchemaMessage, DeltaMessage, BroadcastMessage, ArenaInfo, AnyEntity } from '@/types/protocol'

export interface ArgosrecHeader {
  version?: number
  created?: string
  total_steps?: number
  every_n_steps?: number
  delta?: boolean
  arena?: ArenaInfo
  entity_types?: string[]
  _viz_hints?: Record<string, unknown>
}

export interface ArgosrecFrame {
  type: 'schema' | 'delta' | 'full'
  step: number
  message: SchemaMessage | DeltaMessage | BroadcastMessage
}

export interface ArgosrecFile {
  header: ArgosrecHeader
  frames: ArgosrecFrame[]
  warnings: string[]
}

/** Decompress gzip if needed, return text */
async function toText(file: File): Promise<string> {
  if (file.name.endsWith('.gz')) {
    const buf = await file.arrayBuffer()
    const decompressed = inflate(new Uint8Array(buf))
    return new TextDecoder().decode(decompressed)
  }
  return file.text()
}

/** Parse a single JSON line, returning null on failure */
function parseLine(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

/** Convert a raw parsed line into a typed frame */
function toFrame(obj: Record<string, unknown>, step: number): ArgosrecFrame | null {
  const type = obj.type as string
  if (type === 'schema') {
    return {
      type: 'schema', step: (obj.step as number) ?? step,
      message: { type: 'schema', arena: obj.arena as ArenaInfo, entities: obj.entities as AnyEntity[], user_data: obj.user_data } as SchemaMessage,
    }
  }
  if (type === 'delta') {
    return {
      type: 'delta', step: (obj.step as number) ?? step,
      message: { type: 'delta', entities: obj.entities as Record<string, Partial<AnyEntity>>, user_data: obj.user_data } as DeltaMessage,
    }
  }
  if (type === 'full' || type === 'broadcast') {
    return {
      type: 'full', step: (obj.step as number) ?? step,
      message: {
        type: 'broadcast',
        state: (obj.state as string) ?? 'EXPERIMENT_PLAYING',
        steps: (obj.step as number) ?? step,
        timestamp: (obj.timestamp as number) ?? Date.now(),
        arena: obj.arena as ArenaInfo,
        entities: obj.entities as AnyEntity[],
        user_data: obj.user_data,
      } as BroadcastMessage,
    }
  }
  return null
}

export async function parseArgosrec(file: File): Promise<ArgosrecFile> {
  const warnings: string[] = []
  let text: string

  try {
    text = await toText(file)
  } catch {
    return { header: {}, frames: [], warnings: ['Failed to decompress file — it may be corrupted.'] }
  }

  const lines = text.split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) {
    return { header: {}, frames: [], warnings: ['File is empty.'] }
  }

  let header: ArgosrecHeader = {}
  let startIdx = 0

  // Check if first line is a header
  const first = parseLine(lines[0])
  if (first && first.type === 'header') {
    header = first as unknown as ArgosrecHeader
    startIdx = 1
  }

  const frames: ArgosrecFrame[] = []
  let failedLines = 0

  for (let i = startIdx; i < lines.length; i++) {
    const obj = parseLine(lines[i])
    if (!obj) { failedLines++; continue }
    const frame = toFrame(obj, i - startIdx)
    if (frame) frames.push(frame)
    else failedLines++
  }

  if (failedLines > 0) {
    warnings.push(`${failedLines} line(s) could not be parsed.`)
  }

  // Infer header from first schema if missing
  if (!header.arena && frames.length > 0 && frames[0].type === 'schema') {
    const schema = frames[0].message as SchemaMessage
    header.arena = schema.arena
  }

  header.total_steps = header.total_steps ?? frames.length

  return { header, frames, warnings }
}
