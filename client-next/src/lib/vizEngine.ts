import type { AnyEntity } from '@/types/protocol'
import { builtinFields } from './computedFields'

export interface FieldSchema {
  fieldName: string
  type: 'number' | 'string' | 'boolean' | 'array' | 'object'
  sampleValues: unknown[]
  computed?: boolean
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

export function discoverFields(
  entities: Map<string, AnyEntity>,
  computedFieldValues?: Map<string, Record<string, unknown>>,
): FieldSchema[] {
  const fields = new Map<string, { type: FieldSchema['type']; samples: Set<string> }>()

  // Discover server-provided user_data fields
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

  const result: FieldSchema[] = Array.from(fields.entries()).map(([fieldName, { type, samples }]) => ({
    fieldName,
    type,
    sampleValues: Array.from(samples).map((s) => JSON.parse(s)),
  }))

  // Add computed fields
  for (const def of builtinFields) {
    const samples: unknown[] = []
    if (computedFieldValues) {
      for (const vals of computedFieldValues.values()) {
        if (samples.length >= 3) break
        if (vals[def.name] !== undefined) samples.push(vals[def.name])
      }
    }
    result.push({
      fieldName: def.name,
      type: def.type,
      sampleValues: samples,
      computed: true,
    })
  }

  return result
}
