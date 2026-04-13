import { create } from 'zustand'
import type { ClientCommand, Vec3, Quaternion } from '../types/protocol'
import { WebvizConnection, type ConnectionStatus } from '../protocol/connection'
import { useExperimentStore } from './experimentStore'
import { useLogStore } from './logStore'
import { useRecordingStore } from './recordingStore'
import { useSettingsStore } from './settingsStore'

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
  moveEntity: (id: string, pos: Vec3, orient: Quaternion) => void
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

    conn.onStatusChange = (status) => set({ status })

    conn.onMessage = (msg) => {
      switch (msg.type) {
        case 'broadcast':
          useExperimentStore.getState().applyBroadcast(msg)
          useRecordingStore.getState().captureFrame(msg)
          break
        case 'log':
          useLogStore.getState().addMessages(msg.messages)
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
  moveEntity: (id, pos, orient) =>
    get().send({ command: 'moveEntity', entity_id: id, position: pos, orientation: orient }),
}))
