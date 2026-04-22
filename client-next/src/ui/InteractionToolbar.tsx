import { useEffect } from 'react'
import { useInteractionStore, type InteractionMode } from '@/stores/interactionStore'
import { usePlacementStore } from '@/stores/placementStore'

const MODES: { mode: InteractionMode; icon: string; label: string; shortcut: string }[] = [
  { mode: 'select', icon: '🖱️', label: 'Select', shortcut: 'V' },
  { mode: 'place', icon: '📍', label: 'Place', shortcut: 'P' },
  { mode: 'distribute', icon: '🎲', label: 'Distribute', shortcut: 'D' },
]

export function InteractionToolbar() {
  const { mode, setMode } = useInteractionStore()
  const placementActive = usePlacementStore((s) => s.active)

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'v' || e.key === 'V') { setMode('select'); usePlacementStore.getState().cancelPlacement() }
      else if (e.key === 'p' || e.key === 'P') setMode('place')
      else if (e.key === 'd' || e.key === 'D') setMode('distribute')
      else if (e.key === 'Escape') { setMode('select'); usePlacementStore.getState().cancelPlacement() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMode])

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 bg-card/90 backdrop-blur border rounded-lg shadow-lg px-1 py-1">
      {MODES.map((m) => (
        <button
          key={m.mode}
          title={`${m.label} (${m.shortcut})`}
          className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mode === m.mode
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'hover:bg-accent text-muted-foreground'
          }`}
          onClick={() => {
            setMode(m.mode)
            if (m.mode === 'select') {
              usePlacementStore.getState().cancelPlacement()
            }
          }}
        >
          <span>{m.icon}</span>
          <span className="hidden sm:inline">{m.label}</span>
        </button>
      ))}

      {/* Status indicator */}
      {mode === 'place' && placementActive && (
        <div className="ml-1 px-2 py-1 text-[10px] text-muted-foreground border-l">
          Click to place · ESC to cancel
        </div>
      )}
      {mode === 'select' && (
        <div className="ml-1 px-2 py-1 text-[10px] text-muted-foreground border-l">
          Ctrl+drag to move
        </div>
      )}
    </div>
  )
}
