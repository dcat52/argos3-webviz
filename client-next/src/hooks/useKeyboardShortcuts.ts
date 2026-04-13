import { useEffect } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { ExperimentState } from '@/types/protocol'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return
      const { play, pause, step, reset, fastForward } = useConnectionStore.getState()
      const { state } = useExperimentStore.getState()
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          state === ExperimentState.EXPERIMENT_PLAYING ? pause() : play()
          break
        case 'ArrowRight': e.preventDefault(); step(); break
        case 'KeyR': if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); reset() } break
        case 'KeyF': if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); fastForward() } break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
