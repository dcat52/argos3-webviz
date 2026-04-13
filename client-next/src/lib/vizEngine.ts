import type { AnyEntity } from '@/types/protocol'

export interface FieldSchema {
  fieldName: string
  type: 'number' | 'string' | 'boolean' | 'array' | 'object'
  sampleValues: unknown[]
}

function classifyType(v: unknown): FieldSchema['type'] {
  if (Array.isArray(v)) return 'array'
  if (v === null || v === undefined) return 'string'
  const t = typeof v
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  if (t === 'object') return 'object'
  return 'string'
}

export function discoverFields(entities: Map<string, AnyEntity>): FieldSchema[] {
  const fields = new Map<string, { type: FieldSchema['type']; samples: Set<string> }>()

  for (const entity of entities.values()) {
    const ud = 'user_data' in entity ? entity.user_data : undefined
    if (!ud || typeof ud !== 'object') continue
    for (const [key, val] of Object.entries(ud as Record<string, unknown>)) {
      if (key.startsWith('_')) continue
      const existing = fields.get(key)
      const type = classifyType(val)
      if (!existing) {
        fields.set(key, { type, samples: new Set([JSON.stringify(val)]) })
      } else {
        if (existing.samples.size < 5) existing.samples.add(JSON.stringify(val))
      }
    }
  }

  return Array.from(fields.entries()).map(([fieldName, { type, samples }]) => ({
    fieldName,
    type,
    sampleValues: Array.from(samples).map((s) => JSON.parse(s)),
  }))
}
