import { create } from 'zustand'
import { ExperimentState, type ArenaInfo, type AnyEntity, type BroadcastMessage, type SchemaMessage, type DeltaMessage, type DrawCommand, type FloorColorGrid } from '../types/protocol'
import { computeFields } from '../lib/computedFields'

function extractDraw(userData: unknown): DrawCommand[] {
  if (!userData || typeof userData !== 'object') return []
  const ud = userData as Record<string, unknown>
  if (!Array.isArray(ud._draw)) return []
  return ud._draw.filter((c: unknown) => c && typeof c === 'object' && 'shape' in (c as object)) as DrawCommand[]
}

function extractFloor(userData: unknown): FloorColorGrid | null {
  if (!userData || typeof userData !== 'object') return null
  const ud = userData as Record<string, unknown>
  const f = ud._floor as FloorColorGrid | undefined
  if (!f || !f.resolution || !f.colors) return null
  return f
}

interface ExperimentState_ {
  state: ExperimentState
  steps: number
  timestamp: number
  realTimeRatio: number
  arena: ArenaInfo | null
  entities: Map<string, AnyEntity>
  prevEntities: Map<string, AnyEntity>
  computedFields: Map<string, Record<string, unknown>>
  drawCommands: DrawCommand[]
  floorData: FloorColorGrid | null
  userData: unknown
  selectedEntityId: string | null
  applyBroadcast: (msg: BroadcastMessage) => void
  applySchema: (msg: SchemaMessage) => void
  applyDelta: (msg: DeltaMessage) => void
  applyMessage: (msg: BroadcastMessage | SchemaMessage | DeltaMessage) => void
  selectEntity: (id: string | null) => void
}

export const useExperimentStore = create<ExperimentState_>((set, get) => ({
  state: ExperimentState.EXPERIMENT_INITIALIZED,
  steps: 0,
  timestamp: 0,
  realTimeRatio: 1.0,
  arena: null,
  entities: new Map(),
  prevEntities: new Map(),
  computedFields: new Map(),
  drawCommands: [],
  floorData: null,
  userData: undefined,
  selectedEntityId: null,

  applyBroadcast: (msg) => {
    const prev = get().entities
    const next = new Map<string, AnyEntity>()
    for (const entity of msg.entities) {
      next.set(entity.id, entity)
    }
    set({
      state: msg.state,
      steps: msg.steps,
      timestamp: msg.timestamp,
      realTimeRatio: (msg as any).real_time_ratio ?? get().realTimeRatio,
      arena: msg.arena,
      entities: next,
      prevEntities: prev,
      computedFields: computeFields(next, prev, msg.arena),
      drawCommands: extractDraw(msg.user_data),
      floorData: extractFloor(msg.user_data),
      userData: msg.user_data,
    })
  },

  applySchema: (msg) => {
    const prev = get().entities
    const next = new Map<string, AnyEntity>()
    for (const entity of msg.entities) {
      next.set(entity.id, entity)
    }
    set({
      state: msg.state ?? get().state,
      steps: msg.steps ?? 0,
      timestamp: msg.timestamp ?? Date.now(),
      realTimeRatio: (msg as any).real_time_ratio ?? get().realTimeRatio,
      arena: msg.arena,
      entities: next,
      prevEntities: prev,
      computedFields: computeFields(next, prev, msg.arena),
      drawCommands: extractDraw(msg.user_data),
      floorData: extractFloor(msg.user_data),
      userData: msg.user_data,
    })
  },

  applyDelta: (msg) => {
    const prev = get().entities
    const next = new Map(prev)

    for (const [id, changes] of Object.entries(msg.entities)) {
      const existing = next.get(id)
      if (existing) {
        next.set(id, { ...existing, ...changes } as AnyEntity)
      } else {
        next.set(id, changes as AnyEntity)
      }
    }

    const arena = msg.arena ?? get().arena
    set({
      state: msg.state ?? get().state,
      steps: msg.steps ?? get().steps,
      timestamp: msg.timestamp ?? Date.now(),
      realTimeRatio: (msg as any).real_time_ratio ?? get().realTimeRatio,
      arena,
      entities: next,
      prevEntities: prev,
      computedFields: computeFields(next, prev, arena),
      drawCommands: extractDraw(msg.user_data ?? get().userData),
      floorData: extractFloor(msg.user_data ?? get().userData),
      userData: msg.user_data ?? get().userData,
    })
  },

  applyMessage: (msg) => {
    switch (msg.type) {
      case 'broadcast': get().applyBroadcast(msg); break
      case 'schema': get().applySchema(msg); break
      case 'delta': get().applyDelta(msg); break
    }
  },

  selectEntity: (id) => set({ selectedEntityId: id }),
}))
