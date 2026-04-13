import { create } from 'zustand'
import type { BroadcastMessage } from '../types/protocol'
import { useExperimentStore } from './experimentStore'
import { useConnectionStore } from './connectionStore'

interface RecordedFrame {
  timestamp: number
  message: BroadcastMessage
}

type RecordingState = 'idle' | 'recording' | 'replaying'

interface RecordingStore {
  state: RecordingState
  frames: RecordedFrame[]
  frameIndex: number
  totalFrames: number
  speed: number
  playing: boolean
  _rafId: number | null
  _savedUrl: string | null

  startRecording: () => void
  stopRecording: () => void
  captureFrame: (msg: BroadcastMessage) => void
  downloadRecording: () => void
  loadRecording: (json: string) => void
  startReplay: () => void
  stopReplay: () => void
  togglePlayPause: () => void
  setSpeed: (s: number) => void
  seekTo: (idx: number) => void
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  state: 'idle',
  frames: [],
  frameIndex: 0,
  totalFrames: 0,
  speed: 1,
  playing: false,
  _rafId: null,
  _savedUrl: null,

  startRecording: () => set({ state: 'recording', frames: [], frameIndex: 0, totalFrames: 0 }),

  stopRecording: () => {
    const { frames } = get()
    set({ state: 'idle', totalFrames: frames.length })
  },

  captureFrame: (msg) => {
    if (get().state !== 'recording') return
    set((s) => {
      const frames = [...s.frames, { timestamp: performance.now(), message: msg }]
      return { frames, totalFrames: frames.length }
    })
  },

  downloadRecording: () => {
    const { frames } = get()
    const blob = new Blob([JSON.stringify(frames)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `argos-recording-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  },

  loadRecording: (json) => {
    const frames = JSON.parse(json) as RecordedFrame[]
    set({ frames, totalFrames: frames.length, frameIndex: 0, state: 'idle' })
  },

  startReplay: () => {
    const { frames } = get()
    if (frames.length === 0) return
    // Disconnect live WS
    const url = useConnectionStore.getState().url
    useConnectionStore.getState().disconnect()
    set({ state: 'replaying', frameIndex: 0, playing: true, _savedUrl: url })
    // Apply first frame
    useExperimentStore.getState().applyBroadcast(frames[0].message)
    get()._playLoop()
  },

  stopReplay: () => {
    const { _rafId, _savedUrl } = get()
    if (_rafId) cancelAnimationFrame(_rafId)
    set({ state: 'idle', playing: false, _rafId: null })
    // Reconnect
    if (_savedUrl) useConnectionStore.getState().connect(_savedUrl)
  },

  togglePlayPause: () => {
    const { playing } = get()
    if (playing) {
      const { _rafId } = get()
      if (_rafId) cancelAnimationFrame(_rafId)
      set({ playing: false, _rafId: null })
    } else {
      set({ playing: true })
      get()._playLoop()
    }
  },

  setSpeed: (speed) => set({ speed }),

  seekTo: (idx) => {
    const { frames } = get()
    if (idx >= 0 && idx < frames.length) {
      set({ frameIndex: idx })
      useExperimentStore.getState().applyBroadcast(frames[idx].message)
    }
  },

  _playLoop() {
    const { frames, frameIndex, speed } = get()
    if (frameIndex >= frames.length - 1) {
      set({ playing: false, _rafId: null })
      return
    }
    const nextIdx = frameIndex + 1
    const dt = (frames[nextIdx].timestamp - frames[frameIndex].timestamp) / speed

    const id = requestAnimationFrame(() => {
      setTimeout(() => {
        if (!get().playing || get().state !== 'replaying') return
        set({ frameIndex: nextIdx })
        useExperimentStore.getState().applyBroadcast(frames[nextIdx].message)
        get()._playLoop()
      }, Math.max(0, dt))
    })
    set({ _rafId: id })
  },
}))
