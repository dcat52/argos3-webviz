import { create } from 'zustand'
import { ExperimentState, type ArenaInfo, type AnyEntity, type BroadcastMessage, type SchemaMessage, type DeltaMessage } from '../types/protocol'
import { computeFields } from '../lib/computedFields'

interface ExperimentState_ {
  state: ExperimentState
  steps: number
  timestamp: number
  arena: ArenaInfo | null
  entities: Map<string, AnyEntity>
  prevEntities: Map<string, AnyEntity>
  computedFields: Map<string, Record<string, unknown>>
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
  arena: null,
  entities: new Map(),
  prevEntities: new Map(),
  computedFields: new Map(),
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
      arena: msg.arena,
      entities: next,
      prevEntities: prev,
      computedFields: computeFields(next, prev, msg.arena),
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
      arena: msg.arena,
      entities: next,
      prevEntities: prev,
      computedFields: computeFields(next, prev, msg.arena),
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
      arena,
      entities: next,
      prevEntities: prev,
      computedFields: computeFields(next, prev, arena),
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
