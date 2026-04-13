import { create } from 'zustand'
import { ExperimentState, type ArenaInfo, type AnyEntity, type BroadcastMessage } from '../types/protocol'

interface ExperimentState_ {
  state: ExperimentState
  steps: number
  timestamp: number
  arena: ArenaInfo | null
  entities: Map<string, AnyEntity>
  userData: unknown
  selectedEntityId: string | null
  applyBroadcast: (msg: BroadcastMessage) => void
  selectEntity: (id: string | null) => void
}

export const useExperimentStore = create<ExperimentState_>((set) => ({
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

  selectEntity: (id) => set({ selectedEntityId: id }),
}))
