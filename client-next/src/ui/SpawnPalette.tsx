import { useState, useCallback } from 'react'
import { useMetadataStore } from '@/stores/metadataStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { useInteractionStore } from '@/stores/interactionStore'
import { yawQuaternion } from '@/stores/placementStore'
import { generatePositions } from '@/lib/distribute'
import { ENTITY_DEFAULTS, EntityPicker, isRobotType } from './EntityPicker'
import { useFeature } from '@/stores/featureStore'
import type { Vec3 } from '@/types/protocol'

type BatchMode = 'center' | 'random' | 'grid'

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
  }
}

export function SpawnPalette() {
  const { loaded } = useMetadataStore()
  const controllers = useMetadataStore((s) => s.controllers)
  const editing = useInteractionStore((s) => s.editing)
  const enterEditing = useInteractionStore((s) => s.enterEditing)
  const batchEnabled = useFeature('batch-spawn')
  const [selectedType, setSelectedType] = useState('')
  const [controller, setController] = useState('')
  const [prefix, setPrefix] = useState('')
  const [batchMode, setBatchMode] = useState<BatchMode>('center')
  const [quantity, setQuantity] = useState(5)
  const [randomOrientation, setRandomOrientation] = useState(true)

  const needsController = isRobotType(selectedType) && controllers.length > 0
  const canSpawn = selectedType && (!needsController || controller)

  const handleBatchSpawn = useCallback(() => {
    if (!canSpawn) return
    const base = {
      type: selectedType, id_prefix: prefix || selectedType,
      controller: needsController ? controller : undefined,
      ...ENTITY_DEFAULTS[selectedType],
    }
    for (const pos of batchPositions(batchMode, quantity)) {
      const orientation = randomOrientation
        ? yawQuaternion(Math.random() * Math.PI * 2)
        : { x: 0, y: 0, z: 0, w: 1 }
      useConnectionStore.getState().addEntity({ ...base, position: pos, orientation })
    }
  }, [canSpawn, selectedType, controller, prefix, needsController, batchMode, quantity, randomOrientation])

  if (!loaded) return <div className="text-xs text-muted-foreground p-2">Loading metadata...</div>

  return (
    <div className="flex flex-col gap-2 p-2 text-sm">
      <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Spawn Entity</div>

      {/* Edit mode entry point */}
      {!editing && (
        <button
          className="bg-primary text-primary-foreground rounded px-2 py-1.5 text-xs font-medium"
          onClick={enterEditing}
        >
          Enter Edit Mode (E)
        </button>
      )}

      {editing && (
        <div className="text-xs text-muted-foreground py-1">
          Use toolbar above viewport to place or distribute entities.
        </div>
      )}

      {/* Batch spawn — quick action, gated by feature flag */}
      {batchEnabled && <div className="border-t pt-2 mt-1">
        <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Quick Batch Spawn</div>
        <EntityPicker selectedType={selectedType} controller={controller} onTypeChange={setSelectedType} onControllerChange={setController} />
        <input className="bg-background border rounded px-2 py-1 text-sm w-full mt-1" placeholder="ID prefix (optional)" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        <div className="flex gap-1 mt-1">
          {(['center', 'random', 'grid'] as BatchMode[]).map((m) => (
            <button key={m} className={`flex-1 rounded px-1.5 py-1 text-xs capitalize ${batchMode === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setBatchMode(m)}>{m}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <label className="text-xs text-muted-foreground">Qty</label>
          <input type="range" min={1} max={50} value={quantity} className="flex-1" onChange={(e) => setQuantity(Number(e.target.value))} />
          <span className="text-xs font-mono w-6 text-right">{quantity}</span>
        </div>
        <label className="flex items-center gap-1 text-xs text-muted-foreground mt-1 cursor-pointer">
          <input type="checkbox" checked={randomOrientation} onChange={(e) => setRandomOrientation(e.target.checked)} className="rounded" />
          Random heading
        </label>
        <button
          className="w-full bg-primary text-primary-foreground rounded px-2 py-1.5 text-xs font-medium disabled:opacity-50 mt-1"
          disabled={!canSpawn}
          onClick={handleBatchSpawn}
        >
          Spawn {quantity}× {selectedType || '...'}
        </button>
      </div>}
    </div>
  )
}
