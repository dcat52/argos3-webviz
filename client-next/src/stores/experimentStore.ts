import { create } from 'zustand'
import { ExperimentState, type ArenaInfo, type AnyEntity, type BroadcastMessage, type SchemaMessage, type DeltaMessage } from '../types/protocol'

interface ExperimentState_ {
  state: ExperimentState
  steps: number
  timestamp: number
  arena: ArenaInfo | null
  entities: Map<string, AnyEntity>
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
  userData: undefined,
  selectedEntityId: null,

  applyBroadcast: (msg) => {
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
      userData: msg.user_data,
    })
  },

  applySchema: (msg) => {
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
      userData: msg.user_data,
    })
  },

  applyDelta: (msg) => {
    const prev = get().entities
    const next = new Map(prev)

    for (const [id, changes] of Object.entries(msg.entities)) {
      const existing = next.get(id)
      if (existing) {
        // Merge changes into existing entity
        next.set(id, { ...existing, ...changes } as AnyEntity)
      } else {
        // New entity in delta — must have full data
        next.set(id, changes as AnyEntity)
      }
    }

    set({
      state: msg.state ?? get().state,
      steps: msg.steps ?? get().steps,
      timestamp: msg.timestamp ?? Date.now(),
      arena: msg.arena ?? get().arena,
      entities: next,
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
