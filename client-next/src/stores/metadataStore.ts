import { create } from 'zustand'

interface MetadataState {
  controllers: string[]
  entityTypes: string[]
  loaded: boolean
  applyMetadata: (msg: { controllers: string[]; entity_types: string[] }) => void
}

export const useMetadataStore = create<MetadataState>((set) => ({
  controllers: [],
  entityTypes: [],
  loaded: false,
  applyMetadata: (msg) => set({
    controllers: msg.controllers,
    entityTypes: msg.entity_types,
    loaded: true,
  }),
}))
