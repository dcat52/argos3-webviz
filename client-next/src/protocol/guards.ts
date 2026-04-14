import type { ServerMessage } from '../types/protocol'

export function isServerMessage(data: unknown): data is ServerMessage {
  if (typeof data !== 'object' || data === null) return false
  const t = (data as Record<string, unknown>)['type']
  return t === 'broadcast' || t === 'schema' || t === 'delta' || t === 'event' || t === 'log'
}
