import { useEffect } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { ExperimentState } from '@/types/protocol'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return
      const { pause, step, reset, playAtSpeed } = useConnectionStore.getState()
      const { state } = useExperimentStore.getState()
      const isRunning = state === ExperimentState.EXPERIMENT_PLAYING || state === ExperimentState.EXPERIMENT_FAST_FORWARDING
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          isRunning ? pause() : playAtSpeed(1)
          break
        case 'ArrowRight': e.preventDefault(); step(); break
        case 'KeyR': if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); reset() } break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
