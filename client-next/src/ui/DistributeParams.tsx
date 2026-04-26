import { useState, useMemo, useEffect, useCallback } from 'react'
import { useMetadataStore } from '@/stores/metadataStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { usePlacementStore, yawQuaternion } from '@/stores/placementStore'
import { generatePositions } from '@/lib/distribute'
import { EntityPicker, ENTITY_DEFAULTS, isRobotType } from './EntityPicker'
import type { Vec3 } from '@/types/protocol'

type DistMethod = 'uniform' | 'gaussian' | 'grid'

export function DistributeParams() {
  const controllers = useMetadataStore((s) => s.controllers)
  const [selectedType, setSelectedType] = useState('')
  const [controller, setController] = useState('')
  const [prefix, setPrefix] = useState('')
  const [method, setMethod] = useState<DistMethod>('uniform')
  const [quantity, setQuantity] = useState(5)
  const [centerX, setCenterX] = useState(0)
  const [centerY, setCenterY] = useState(0)
  const [rangeX, setRangeX] = useState(2)
  const [rangeY, setRangeY] = useState(2)
  const [spacing, setSpacing] = useState(0.5)
  const [randomOrientation, setRandomOrientation] = useState(true)

  const needsController = isRobotType(selectedType) && controllers.length > 0
  const canSpawn = selectedType && (!needsController || controller)

  const positions = useMemo(() => {
    if (!selectedType) return []
    try {
      if (method === 'uniform') {
        return generatePositions('uniform', { min: { x: centerX - rangeX, y: centerY - rangeY, z: 0 }, max: { x: centerX + rangeX, y: centerY + rangeY, z: 0 } }, quantity, 42)
      } else if (method === 'gaussian') {
        return generatePositions('gaussian', { mean: { x: centerX, y: centerY, z: 0 }, std_dev: { x: rangeX / 2, y: rangeY / 2, z: 0 } }, quantity, 42)
      } else {
        const cols = Math.ceil(Math.sqrt(quantity))
        return generatePositions('grid', {
          center: { x: centerX, y: centerY, z: 0 },
          distances: { x: spacing, y: spacing, z: 0 },
          layout: [cols, Math.ceil(quantity / cols), 1],
        }, quantity)
      }
    } catch { return [] }
  }, [selectedType, method, quantity, centerX, centerY, rangeX, rangeY, spacing])

  // Generate stable random orientations for preview (seeded by quantity)
  const orientations = useMemo(() => {
    if (!randomOrientation) return []
    // Use a simple seeded sequence so preview is stable across renders
    let seed = 7919
    return positions.map(() => {
      seed = (seed * 16807 + 0) % 2147483647
      return yawQuaternion((seed / 2147483647) * Math.PI * 2)
    })
  }, [positions, randomOrientation])

  // Sync ghost preview
  useEffect(() => {
    if (selectedType && positions.length) {
      usePlacementStore.getState().setPreviewPositions(positions, selectedType, orientations)
    } else {
      usePlacementStore.getState().setPreviewPositions([])
    }
    return () => { usePlacementStore.getState().setPreviewPositions([]) }
  }, [positions, selectedType, orientations])

  const handleCommit = useCallback(() => {
    if (!canSpawn) return
    const base = {
      type: selectedType, id_prefix: prefix || selectedType,
      controller: needsController ? controller : undefined,
      ...ENTITY_DEFAULTS[selectedType],
    }
    for (let i = 0; i < positions.length; i++) {
      const orientation = orientations[i] ?? { x: 0, y: 0, z: 0, w: 1 }
      useConnectionStore.getState().addEntity({ ...base, position: positions[i], orientation })
    }
  }, [canSpawn, selectedType, prefix, controller, needsController, positions, orientations])

  return (
    <div className="bg-card/90 backdrop-blur border rounded-lg shadow-lg px-3 py-2 flex items-center gap-3 text-xs flex-wrap max-w-[700px]">
      {/* Entity type + controller */}
      <EntityPicker selectedType={selectedType} controller={controller} onTypeChange={setSelectedType} onControllerChange={setController} />

      {/* Method */}
      <div className="flex gap-0.5">
        {(['uniform', 'gaussian', 'grid'] as DistMethod[]).map((m) => (
          <button key={m} className={`rounded px-1.5 py-0.5 text-xs capitalize ${method === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setMethod(m)}>{m}</button>
        ))}
      </div>

      {/* Qty */}
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Qty</span>
        <input type="range" min={1} max={50} value={quantity} className="w-16" onChange={(e) => setQuantity(+e.target.value)} />
        <span className="font-mono w-5 text-right">{quantity}</span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-0.5">
        <span className="text-muted-foreground">C</span>
        <input type="number" step={0.5} value={centerX} onChange={(e) => setCenterX(+e.target.value)} className="w-12 bg-background border rounded px-1 text-xs" />
        <input type="number" step={0.5} value={centerY} onChange={(e) => setCenterY(+e.target.value)} className="w-12 bg-background border rounded px-1 text-xs" />
      </div>

      {/* Range */}
      <div className="flex items-center gap-0.5">
        <span className="text-muted-foreground">±</span>
        <input type="number" step={0.5} min={0.1} value={rangeX} onChange={(e) => setRangeX(+e.target.value)} className="w-12 bg-background border rounded px-1 text-xs" />
        <input type="number" step={0.5} min={0.1} value={rangeY} onChange={(e) => setRangeY(+e.target.value)} className="w-12 bg-background border rounded px-1 text-xs" />
      </div>

      {method === 'grid' && (
        <div className="flex items-center gap-0.5">
          <span className="text-muted-foreground">Gap</span>
          <input type="number" step={0.1} min={0.1} value={spacing} onChange={(e) => setSpacing(+e.target.value)} className="w-12 bg-background border rounded px-1 text-xs" />
        </div>
      )}

      {/* Random orientation */}
      <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={randomOrientation} onChange={(e) => setRandomOrientation(e.target.checked)} className="rounded" />
        Random heading
      </label>

      {/* Commit */}
      <button
        className="bg-primary text-primary-foreground rounded px-3 py-1 text-xs font-medium disabled:opacity-50 ml-auto"
        disabled={!canSpawn}
        onClick={handleCommit}
      >
        Distribute {positions.length}×
      </button>
    </div>
  )
}
