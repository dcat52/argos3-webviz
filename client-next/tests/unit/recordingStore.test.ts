import { describe, test, expect, beforeEach } from 'vitest'
import { useRecordingStore } from '@/stores/recordingStore'
import { makeBroadcast, makeEntity } from '../helpers'

beforeEach(() => {
  useRecordingStore.setState({
    state: 'idle', frames: [], frameIndex: 0, totalFrames: 0, speed: 1, playing: false,
  })
})

describe('recording', () => {
  test('captureFrame ignores when not recording', () => {
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    expect(useRecordingStore.getState().frames.length).toBe(0)
  })

  test('captureFrame stores frames when recording', () => {
    useRecordingStore.getState().startRecording()
    useRecordingStore.getState().captureFrame(makeBroadcast([makeEntity('r0')]))
    useRecordingStore.getState().captureFrame(makeBroadcast([makeEntity('r0', 1, 1)]))
    expect(useRecordingStore.getState().frames.length).toBe(2)
  })

  test('stopRecording sets totalFrames', () => {
    useRecordingStore.getState().startRecording()
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    useRecordingStore.getState().stopRecording()
    expect(useRecordingStore.getState().totalFrames).toBe(3)
    expect(useRecordingStore.getState().state).toBe('idle')
  })
})

describe('loadRecording', () => {
  test('parses JSON and sets frames', () => {
    const frames = [
      { timestamp: 100, message: makeBroadcast([makeEntity('r0')]) },
      { timestamp: 200, message: makeBroadcast([makeEntity('r0', 1, 1)]) },
    ]
    useRecordingStore.getState().loadRecording(JSON.stringify(frames))
    expect(useRecordingStore.getState().frames.length).toBe(2)
    expect(useRecordingStore.getState().totalFrames).toBe(2)
  })
})

describe('seekTo', () => {
  test('sets frameIndex within bounds', () => {
    const frames = [
      { timestamp: 100, message: makeBroadcast([makeEntity('r0')]) },
      { timestamp: 200, message: makeBroadcast([makeEntity('r0', 1, 1)]) },
    ]
    useRecordingStore.getState().loadRecording(JSON.stringify(frames))
    useRecordingStore.getState().seekTo(1)
    expect(useRecordingStore.getState().frameIndex).toBe(1)
  })
})
