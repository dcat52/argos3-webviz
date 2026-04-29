# PN-032: Client Rendering Pipeline — Design Doc

## Lazy Computed Fields

### Active Field Detection

```typescript
// lib/computedFields.ts — new export
export function getActiveComputedFields(config: VizConfig): Set<string> {
  const active = new Set<string>()
  if (config.colorBy?.enabled && config.colorBy.field.startsWith('_'))
    active.add(config.colorBy.field)
  for (const label of config.labels) {
    if (label.enabled && label.field.startsWith('_'))
      active.add(label.field)
  }
  // Heatmap and trails use position, not computed fields
  // Links use user_data fields, not computed fields
  return active
}
```

### Modified computeFields Signature

```typescript
export function computeFields(
  entities: Map<string, AnyEntity>,
  prevEntities: Map<string, AnyEntity>,
  arena: ArenaInfo | null,
  activeFields?: Set<string>,  // NEW — if empty/undefined, compute nothing
): Map<string, Record<string, unknown>> {
  if (!activeFields || activeFields.size === 0) return EMPTY_MAP

  const needed = builtinFields.filter(f => activeFields.has(f.name))
  // ... compute only needed fields ...
}
```

### Integration in experimentStore

```typescript
applyBroadcast: (msg) => {
  // ... build entity map ...
  const activeFields = getActiveComputedFields(useVizConfigStore.getState().config)
  set({
    // ...
    computedFields: computeFields(next, prev, msg.arena, activeFields),
  })
}
```

### Field Discovery

`discoverFields()` in `vizEngine.ts` currently iterates `computedFieldValues` to get sample values. With lazy fields, samples may not exist. Solution: compute a single sample entity's fields on demand for the field picker UI, not for every entity every frame.

```typescript
// vizEngine.ts — modified
for (const def of builtinFields) {
  // Always list computed fields in the picker, even without samples
  result.push({
    fieldName: def.name,
    type: def.type,
    sampleValues: [],  // Samples populated lazily when field is selected
    computed: true,
  })
}
```

## Spatial Hash

### Implementation

```typescript
// lib/spatialHash.ts — new file
export class SpatialHash {
  private cells = new Map<string, string[]>()
  private entityCells = new Map<string, string>()

  constructor(private cellSize: number = 1.0) {}

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`
  }

  rebuild(entities: Map<string, AnyEntity>): void {
    this.cells.clear()
    this.entityCells.clear()
    for (const [id, e] of entities) {
      if (!('position' in e)) continue
      const k = this.key(e.position.x, e.position.y)
      this.entityCells.set(id, k)
      let cell = this.cells.get(k)
      if (!cell) { cell = []; this.cells.set(k, cell) }
      cell.push(id)
    }
  }

  queryRadius(x: number, y: number, radius: number): string[] {
    const results: string[] = []
    const minCX = Math.floor((x - radius) / this.cellSize)
    const maxCX = Math.floor((x + radius) / this.cellSize)
    const minCY = Math.floor((y - radius) / this.cellSize)
    const maxCY = Math.floor((y + radius) / this.cellSize)
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`)
        if (cell) results.push(...cell)
      }
    }
    return results
  }
}
```

### Integration with Computed Fields

The O(N²) fields (`_distance_to_nearest`, `_neighbor_count`) receive the spatial hash as context:

```typescript
export interface ComputeContext {
  entity: AnyEntity
  prevEntity: AnyEntity | undefined
  allEntities: Map<string, AnyEntity>
  arena: ArenaInfo | null
  spatialHash?: SpatialHash  // NEW
}

// _distance_to_nearest — O(N×k) instead of O(N²)
compute: ({ entity, allEntities, spatialHash }) => {
  const p = pos(entity)
  if (!p) return 0
  if (!spatialHash) return bruteForceNearest(entity, allEntities)  // fallback
  const candidates = spatialHash.queryRadius(p.x, p.y, 2.0)  // search 2m radius
  let min = Infinity
  for (const id of candidates) {
    if (id === entity.id) continue
    const other = allEntities.get(id)
    const op = other && pos(other)
    if (!op) continue
    const d = Math.hypot(p.x - op.x, p.y - op.y)
    if (d < min) min = d
  }
  return min === Infinity ? 0 : min
}
```

The spatial hash is rebuilt once per frame (O(N)), then used for all queries. Net cost: O(N) rebuild + O(N×k) queries vs O(N²) brute force.

## In-Place Entity Updates

### Generation Counter Pattern

```typescript
interface ExperimentState_ {
  entities: Map<string, AnyEntity>
  entityGeneration: number  // NEW — bumped on every mutation
  // Remove prevEntities as a full Map — only needed for active computed fields
  prevPositions: Map<string, Vec3>  // lightweight: only positions for _speed/_heading
  // ...
}
```

### applyDelta — Mutate In Place

```typescript
applyDelta: (msg) => {
  const { entities, entityGeneration } = get()

  // Save prev positions for entities that changed (for _speed/_heading)
  const prevPositions = new Map(get().prevPositions)
  for (const [id, changes] of Object.entries(msg.entities)) {
    if ('position' in changes) {
      const existing = entities.get(id)
      if (existing && 'position' in existing) {
        prevPositions.set(id, existing.position)
      }
    }
  }

  // Mutate in place
  for (const [id, changes] of Object.entries(msg.entities)) {
    const existing = entities.get(id)
    if (existing) {
      entities.set(id, { ...existing, ...changes } as AnyEntity)
    } else {
      entities.set(id, changes as AnyEntity)
    }
  }
  if (msg.removed) {
    for (const id of msg.removed) entities.delete(id)
  }

  const arena = msg.arena ?? get().arena
  const activeFields = getActiveComputedFields(useVizConfigStore.getState().config)

  set({
    // Same Map reference, but new generation triggers selectors
    entities,
    entityGeneration: entityGeneration + 1,
    prevPositions,
    arena,
    computedFields: computeFields(entities, prevPositions, arena, activeFields),
    // ... drawCommands, floorData, etc.
  })
}
```

### Zustand Selector Pattern

Components use the generation counter to know when to re-render:

```typescript
// InstancedEntities.tsx
const generation = useExperimentStore((s) => s.entityGeneration)
const entities = useExperimentStore((s) => s.entities)
// React re-renders when generation changes (primitive equality)
```

### applyBroadcast — Full Replace (still needed)

For full broadcast messages (non-delta), we still create a new Map since the entire entity set is replaced. But this only happens for legacy `broadcast` type messages and schema keyframes — not the common delta path.

## MessagePack Client Decoder

### Package

`@msgpack/msgpack` — add to package.json with pinned version.

### Connection Changes

```typescript
// protocol/connection.ts
import { decode } from '@msgpack/msgpack'

// In constructor or connect():
this.ws.binaryType = 'arraybuffer'

// In onmessage:
this.ws.onmessage = (ev: MessageEvent) => {
  if (!this.onMessage) return
  try {
    let data: unknown
    if (ev.data instanceof ArrayBuffer) {
      data = decode(new Uint8Array(ev.data))
    } else {
      data = JSON.parse(String(ev.data))
    }
    if (isServerMessage(data)) this.onMessage(data)
  } catch { /* ignore malformed */ }
}
```

### URL Construction

```typescript
// ConnectionConfig — new optional field
export interface ConnectionConfig {
  url: string
  binary?: boolean  // default true — use msgpack
  // ...
}

private buildUrl(): string {
  const useBinary = this.config.binary !== false
  const broadcastTopic = useBinary ? 'broadcasts.bin' : 'broadcasts'
  const channels = [broadcastTopic, 'events', 'logs'].join(',')
  const sep = this.config.url.includes('?') ? '&' : '?'
  return `${this.config.url}${sep}${channels}`
}
```

## prevEntities Reduction

Currently `prevEntities` stores a full `Map<string, AnyEntity>` — every entity's complete state from the previous frame. This is only needed for:

1. `_speed` — needs prev position (3 floats)
2. `_heading` — needs prev position (3 floats)
3. `_led_changed` — needs prev LEDs (array of strings)

With lazy fields, if none of these are active, prevEntities is not needed at all. When they are active, we only need the specific data:

- `_speed` / `_heading`: store `prevPositions: Map<string, Vec3>` (12 bytes/entity vs ~200+ bytes for full entity)
- `_led_changed`: store `prevLeds: Map<string, string[]>` only when active

This reduces memory from ~2× entity data to ~1.05× for the common case.
