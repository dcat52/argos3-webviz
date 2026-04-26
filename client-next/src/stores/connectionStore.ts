import { create } from 'zustand'
import type { ClientCommand, Vec3, Quaternion } from '../types/protocol'
import { WebvizConnection, type ConnectionStatus } from '../protocol/connection'
import { useExperimentStore } from './experimentStore'
import { useLogStore } from './logStore'
import { useRecordingStore } from './recordingStore'
import { useSettingsStore } from './settingsStore'
import { useMetadataStore } from './metadataStore'
import { SPEED_INFINITY_THRESHOLD, SPEED_TRANSITION_DELAY_MS } from '@/lib/defaults'

interface ConnectionState {
  status: ConnectionStatus
  url: string
  connection: WebvizConnection | null
  connect: (url?: string) => void
  disconnect: () => void
  send: (command: ClientCommand) => void
  play: () => void
  pause: () => void
  step: () => void
  reset: () => void
  terminate: () => void
  fastForward: (steps?: number) => void
  playAtSpeed: (speed: number) => void
  moveEntity: (id: string, pos: Vec3, orient: Quaternion) => void
  addEntity: (params: Record<string, unknown>) => void
  removeEntity: (id: string) => void
  requestMetadata: () => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'disconnected',
  url: `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000`,
  connection: null,

  connect: (url?: string) => {
    get().connection?.disconnect()
    const target = url ?? useSettingsStore.getState().wsUrl ?? get().url
    set({ url: target })

    const conn = new WebvizConnection({
      url: target,
      channels: ['broadcasts', 'events', 'logs'],
    })

    conn.onStatusChange = (status) => {
      set({ status })
      if (status === 'connected') {
        get().requestMetadata()
      }
    }

    conn.onMessage = (msg) => {
      switch (msg.type) {
        case 'broadcast':
        case 'schema':
        case 'delta':
          useExperimentStore.getState().applyMessage(msg)
          if (msg.type === 'broadcast') useRecordingStore.getState().captureFrame(msg)
          // Extract metadata from broadcast/schema messages
          if ('controllers' in (msg as any) && 'entity_types' in (msg as any)) {
            const m = msg as any
            if (!useMetadataStore.getState().loaded) {
              useMetadataStore.getState().applyMetadata(m)
            }
          }
          break
        case 'log':
          useLogStore.getState().addMessages(msg.messages)
          break
        case 'metadata':
          useMetadataStore.getState().applyMetadata(msg as any)
          break
      }
    }

    set({ connection: conn })
    conn.connect()
  },

  disconnect: () => {
    get().connection?.disconnect()
    set({ connection: null, status: 'disconnected' })
  },

  send: (command) => get().connection?.send(command),

  play: () => get().send({ command: 'play' }),
  pause: () => get().send({ command: 'pause' }),
  step: () => get().send({ command: 'step' }),
  reset: () => get().send({ command: 'reset' }),
  terminate: () => get().send({ command: 'terminate' }),
  fastForward: (steps?) => get().send({ command: 'fastforward', ...(steps !== undefined && { steps }) }),
  playAtSpeed: (speed: number) => {
    const { send } = get()
    send({ command: 'pause' })
    setTimeout(() => {
      if (speed >= SPEED_INFINITY_THRESHOLD) {
        send({ command: 'fastforward', steps: SPEED_INFINITY_THRESHOLD })
      } else {
        send({ command: 'speed', factor: speed })
        send({ command: 'play' })
      }
    }, SPEED_TRANSITION_DELAY_MS)
  },
  moveEntity: (id, pos, orient) =>
    get().send({ command: 'moveEntity', entity_id: id, position: pos, orientation: orient }),
  addEntity: (params) =>
    get().send({ command: 'addEntity', ...params } as any),
  removeEntity: (id) =>
    get().send({ command: 'removeEntity', entity_id: id }),
  requestMetadata: () =>
    get().send({ command: 'getMetadata' }),
}))
