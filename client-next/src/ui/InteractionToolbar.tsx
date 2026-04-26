import { useEffect } from 'react'
import { useInteractionStore, type InteractionMode } from '@/stores/interactionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { usePlacementStore } from '@/stores/placementStore'
import { useFeature } from '@/stores/featureStore'
import { DistributeParams } from './DistributeParams'
import { PlaceParams } from './PlaceParams'

const MODES: { mode: InteractionMode; icon: string; label: string; shortcut: string; feature?: string }[] = [
  { mode: 'select', icon: '🖱️', label: 'Select', shortcut: 'V' },
  { mode: 'place', icon: '📍', label: 'Place', shortcut: 'P' },
  { mode: 'distribute', icon: '🎲', label: 'Distribute', shortcut: 'D', feature: 'distribute' },
]

export function InteractionToolbar() {
  const { mode, setMode, editing, enterEditing, exitEditing } = useInteractionStore()
  const distributeEnabled = useFeature('distribute')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'e' || e.key === 'E') { editing ? exitEditing() : enterEditing(); return }
      if (e.key === 'Escape') {
        useExperimentStore.getState().selectEntity(null)
        usePlacementStore.getState().cancelPlacement()
        if (editing) exitEditing()
        return
      }
      if (!editing) return
      if (e.key === 'v' || e.key === 'V') setMode('select')
      else if (e.key === 'p' || e.key === 'P') setMode('place')
      else if ((e.key === 'd' || e.key === 'D') && distributeEnabled) setMode('distribute')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, setMode, enterEditing, exitEditing, distributeEnabled])

  if (!editing) return null

  const visibleModes = MODES.filter((m) => !m.feature || (m.feature === 'distribute' && distributeEnabled))

  if (!editing) return null

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1">
      {/* Mode bar */}
      <div className="flex items-center gap-0.5 bg-card/90 backdrop-blur border rounded-lg shadow-lg px-1 py-1">
        {visibleModes.map((m) => (
          <button
            key={m.mode}
            title={`${m.label} (${m.shortcut})`}
            className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === m.mode ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent text-muted-foreground'
            }`}
            onClick={() => setMode(m.mode)}
          >
            <span>{m.icon}</span>
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}

        {mode === 'select' && (
          <div className="ml-1 px-2 py-1 text-[10px] text-muted-foreground border-l">Ctrl+drag to move</div>
        )}

        <button
          title="Exit edit mode (ESC)"
          className="ml-1 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          onClick={() => { usePlacementStore.getState().cancelPlacement(); exitEditing() }}
        >✕</button>
      </div>

      {/* Sub-toolbar for place params */}
      {mode === 'place' && <PlaceParams />}

      {/* Sub-toolbar for distribute params */}
      {mode === 'distribute' && <DistributeParams />}
    </div>
  )
}
