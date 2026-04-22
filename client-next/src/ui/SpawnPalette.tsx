import { useState, useCallback } from 'react'
import { useMetadataStore } from '@/stores/metadataStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { usePlacementStore } from '@/stores/placementStore'
import { useInteractionStore } from '@/stores/interactionStore'
import { generatePositions } from '@/lib/distribute'
import type { Vec3 } from '@/types/protocol'

type BatchMode = 'single' | 'center' | 'random' | 'grid'

const ENTITY_DEFAULTS: Record<string, Record<string, unknown>> = {
  'box': { size: { x: 0.3, y: 0.3, z: 0.3 }, movable: true, mass: 1.0 },
  'cylinder': { radius: 0.15, height: 0.5, movable: true, mass: 1.0 },
  'foot-bot': {},
  'kheperaiv': {},
}

function batchPositions(mode: BatchMode, quantity: number): Vec3[] {
  const arena = useExperimentStore.getState().arena
  const cx = arena?.center.x ?? 0, cy = arena?.center.y ?? 0
  const hw = arena ? arena.size.x / 2 * 0.8 : 2, hd = arena ? arena.size.y / 2 * 0.8 : 2
  switch (mode) {
    case 'center': return generatePositions('uniform', { min: { x: cx - 0.5, y: cy - 0.5, z: 0 }, max: { x: cx + 0.5, y: cy + 0.5, z: 0 } }, quantity, 42)
    case 'random': return generatePositions('uniform', { min: { x: cx - hw, y: cy - hd, z: 0 }, max: { x: cx + hw, y: cy + hd, z: 0 } }, quantity)
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(quantity))
      return generatePositions('grid', { center: { x: cx, y: cy, z: 0 }, distances: { x: 0.4, y: 0.4, z: 0 }, layout: [cols, Math.ceil(quantity / cols), 1] }, quantity)
    }
    default: return []
  }
}

export function SpawnPalette() {
  const { entityTypes, controllers, loaded } = useMetadataStore()
  const interactionMode = useInteractionStore((s) => s.mode)
  const editing = useInteractionStore((s) => s.editing)
  const [selectedType, setSelectedType] = useState('')
  const [controller, setController] = useState('')
  const [prefix, setPrefix] = useState('')
  const [batchMode, setBatchMode] = useState<BatchMode>('single')
  const [quantity, setQuantity] = useState(1)
  const placementActive = usePlacementStore((s) => s.active)

  const isRobot = selectedType === 'foot-bot' || selectedType === 'kheperaiv'
  const needsController = isRobot && controllers.length > 0
  const canSpawn = selectedType && (!needsController || controller)

  // Auto-start placement in Place mode
  const startPlacement = useCallback(() => {
    if (!canSpawn) return
    usePlacementStore.getState().startPlacement({
      type: selectedType,
      controller: needsController ? controller : undefined,
      id_prefix: prefix || selectedType,
      ...ENTITY_DEFAULTS[selectedType],
    })
  }, [canSpawn, selectedType, controller, prefix, needsController])

  // When entering place mode, auto-start
  // (handled by effect in previous version — keep it simple, just check on render)

  if (!loaded) return <div className="text-xs text-muted-foreground p-2">Loading metadata...</div>

  return (
    <div className="flex flex-col gap-2 p-2 text-sm">
      <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Spawn Entity</div>

      <select className="bg-background border rounded px-2 py-1 text-sm" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
        <option value="">Select type...</option>
        {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      {needsController && (
        <select className="bg-background border rounded px-2 py-1 text-sm" value={controller} onChange={(e) => setController(e.target.value)}>
          <option value="">Select controller...</option>
          {controllers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <input className="bg-background border rounded px-2 py-1 text-sm" placeholder="ID prefix (optional)" value={prefix} onChange={(e) => setPrefix(e.target.value)} />

      {/* Place mode status */}
      {editing && interactionMode === 'place' && (
        <div className="text-xs text-center py-2 text-muted-foreground">
          {placementActive ? '📍 Click viewport to place · ESC to exit' : (
            <button className="bg-primary text-primary-foreground rounded px-3 py-1 disabled:opacity-50" disabled={!canSpawn} onClick={startPlacement}>
              Start Placing
            </button>
          )}
        </div>
      )}

      {/* Distribute mode hint */}
      {editing && interactionMode === 'distribute' && (
        <div className="text-xs text-center py-2 text-muted-foreground">
          🎲 Configure in toolbar above viewport
        </div>
      )}

      {/* Default: batch spawn */}
      {(!editing || interactionMode === 'select') && (
        <>
          <div className="flex gap-1">
            {(['single', 'center', 'random', 'grid'] as BatchMode[]).map((m) => (
              <button key={m} className={`flex-1 rounded px-1.5 py-1 text-xs capitalize ${batchMode === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setBatchMode(m)}>{m}</button>
            ))}
          </div>
          {batchMode !== 'single' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Qty</label>
              <input type="range" min={1} max={50} value={quantity} className="flex-1" onChange={(e) => setQuantity(Number(e.target.value))} />
              <span className="text-xs font-mono w-6 text-right">{quantity}</span>
            </div>
          )}
          <button
            className="bg-primary text-primary-foreground rounded px-2 py-1.5 text-xs font-medium disabled:opacity-50"
            disabled={!canSpawn}
            onClick={() => {
              if (batchMode === 'single') {
                useInteractionStore.getState().setMode('place')
                startPlacement()
              } else {
                const base = {
                  type: selectedType, id_prefix: prefix || selectedType,
                  orientation: { x: 0, y: 0, z: 0, w: 1 },
                  controller: needsController ? controller : undefined,
                  ...ENTITY_DEFAULTS[selectedType],
                }
                for (const pos of batchPositions(batchMode, quantity)) {
                  useConnectionStore.getState().addEntity({ ...base, position: pos })
                }
              }
            }}
          >
            {batchMode === 'single' ? `Place ${selectedType || '...'}` : `Spawn ${quantity}× ${selectedType || '...'}`}
          </button>
        </>
      )}
    </div>
  )
}
