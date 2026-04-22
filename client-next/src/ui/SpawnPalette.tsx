import { useState, useCallback, useMemo, useEffect } from 'react'
import { useMetadataStore } from '@/stores/metadataStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { usePlacementStore } from '@/stores/placementStore'
import { useInteractionStore } from '@/stores/interactionStore'
import { generatePositions } from '@/lib/distribute'
import type { Vec3 } from '@/types/protocol'

type PlacementMode = 'click' | 'center' | 'random' | 'grid' | 'distribute'
type DistMethod = 'uniform' | 'gaussian' | 'grid'

const ENTITY_DEFAULTS: Record<string, Record<string, unknown>> = {
  'box': { size: { x: 0.3, y: 0.3, z: 0.3 }, movable: true, mass: 1.0 },
  'cylinder': { radius: 0.15, height: 0.5, movable: true, mass: 1.0 },
  'foot-bot': {},
  'kheperaiv': {},
}

function findClearSpots(count: number, step: number): Vec3[] {
  const entities = new Map(useExperimentStore.getState().entities)
  const positions: Vec3[] = []
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0
    for (let a = 0; a < 100; a++) {
      const tooClose = Array.from(entities.values()).some(
        (e: any) => 'position' in e && Math.abs(e.position.x - x) < step && Math.abs(e.position.y - y) < step
      )
      if (!tooClose) break
      const angle = a * 2.4
      const r = step * Math.sqrt(a)
      x = r * Math.cos(angle)
      y = r * Math.sin(angle)
    }
    positions.push({ x, y, z: 0 })
    entities.set(`__tmp_${i}`, { position: { x, y, z: 0 } } as any)
  }
  return positions
}

function randomInArena(count: number): Vec3[] {
  const arena = useExperimentStore.getState().arena
  const hw = arena ? arena.size.x / 2 * 0.8 : 2
  const hd = arena ? arena.size.y / 2 * 0.8 : 2
  const cx = arena?.center.x ?? 0, cy = arena?.center.y ?? 0
  return Array.from({ length: count }, () => ({
    x: cx + (Math.random() - 0.5) * 2 * hw,
    y: cy + (Math.random() - 0.5) * 2 * hd,
    z: 0,
  }))
}

function gridPositions(count: number, spacing: number): Vec3[] {
  const cols = Math.ceil(Math.sqrt(count))
  const arena = useExperimentStore.getState().arena
  const cx = arena?.center.x ?? 0, cy = arena?.center.y ?? 0
  return Array.from({ length: count }, (_, i) => ({
    x: cx + (i % cols - (cols - 1) / 2) * spacing,
    y: cy + (Math.floor(i / cols) - (Math.ceil(count / cols) - 1) / 2) * spacing,
    z: 0,
  }))
}

export function SpawnPalette() {
  const { entityTypes, controllers, loaded } = useMetadataStore()
  const [selectedType, setSelectedType] = useState('')
  const [controller, setController] = useState('')
  const [prefix, setPrefix] = useState('')
  const [mode, setMode] = useState<PlacementMode>('click')
  const [quantity, setQuantity] = useState(1)
  const placementActive = usePlacementStore((s) => s.active)

  // Distribute params: center ± range
  const [distMethod, setDistMethod] = useState<DistMethod>('uniform')
  const [distCenterX, setDistCenterX] = useState(0)
  const [distCenterY, setDistCenterY] = useState(0)
  const [distRangeX, setDistRangeX] = useState(2)
  const [distRangeY, setDistRangeY] = useState(2)
  const [distSpacing, setDistSpacing] = useState(0.5)
  const [pickingCenter, setPickingCenter] = useState(false)

  const isRobot = selectedType === 'foot-bot' || selectedType === 'kheperaiv'
  const needsController = isRobot && controllers.length > 0

  // Listen for center pick from placement store
  useEffect(() => {
    if (!pickingCenter) return
    const unsub = usePlacementStore.subscribe((state) => {
      if (state.cursorPos) {
        setDistCenterX(+state.cursorPos.x.toFixed(2))
        setDistCenterY(+state.cursorPos.y.toFixed(2))
      }
    })
    return unsub
  }, [pickingCenter])

  // Generate distribute preview positions
  const distPreview = useMemo(() => {
    if (mode !== 'distribute' || !selectedType) return []
    const cx = distCenterX, cy = distCenterY
    const rx = distRangeX, ry = distRangeY
    try {
      if (distMethod === 'uniform') {
        return generatePositions('uniform', {
          min: { x: cx - rx, y: cy - ry, z: 0 },
          max: { x: cx + rx, y: cy + ry, z: 0 },
        }, quantity, 42)
      } else if (distMethod === 'gaussian') {
        return generatePositions('gaussian', {
          mean: { x: cx, y: cy, z: 0 },
          std_dev: { x: rx / 2, y: ry / 2, z: 0 },
        }, quantity, 42)
      } else {
        return generatePositions('grid', {
          center: { x: cx, y: cy, z: 0 },
          distances: { x: distSpacing, y: distSpacing, z: 0 },
          layout: [Math.ceil(Math.sqrt(quantity)), Math.ceil(quantity / Math.ceil(Math.sqrt(quantity))), 1],
        }, quantity)
      }
    } catch { return [] }
  }, [mode, selectedType, distMethod, quantity, distCenterX, distCenterY, distRangeX, distRangeY, distSpacing])

  // Sync distribute preview to placement store for ghost rendering
  useEffect(() => {
    if (mode === 'distribute' && selectedType) {
      usePlacementStore.getState().setPreviewPositions(distPreview, selectedType)
    } else {
      usePlacementStore.getState().setPreviewPositions([])
    }
  }, [distPreview, mode, selectedType])

  const handleSpawn = useCallback(() => {
    if (!selectedType) return
    if (needsController && !controller) return

    const base: Record<string, unknown> = {
      type: selectedType,
      id_prefix: prefix || selectedType,
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      controller: needsController ? controller : undefined,
      ...ENTITY_DEFAULTS[selectedType],
    }

    if (mode === 'click') {
      useInteractionStore.getState().setMode('place')
      usePlacementStore.getState().startPlacement({
        type: selectedType,
        controller: needsController ? controller : undefined,
        id_prefix: prefix || selectedType,
        ...ENTITY_DEFAULTS[selectedType],
      })
      return
    }

    let positions: Vec3[] = []
    if (mode === 'center') positions = findClearSpots(quantity, 0.3)
    else if (mode === 'random') positions = randomInArena(quantity)
    else if (mode === 'grid') positions = gridPositions(quantity, 0.4)
    else if (mode === 'distribute') positions = distPreview

    for (const pos of positions) {
      useConnectionStore.getState().addEntity({ ...base, position: pos })
    }
  }, [selectedType, controller, prefix, mode, quantity, needsController, distPreview])

  const handlePickCenter = useCallback(() => {
    if (pickingCenter) {
      // Confirm pick
      const pos = usePlacementStore.getState().cursorPos
      if (pos) {
        setDistCenterX(+pos.x.toFixed(2))
        setDistCenterY(+pos.y.toFixed(2))
      }
      usePlacementStore.getState().cancelPlacement()
      setPickingCenter(false)
    } else {
      // Start picking
      setPickingCenter(true)
      usePlacementStore.getState().startPlacement({
        type: selectedType || 'box',
        id_prefix: '__center_pick',
      })
    }
  }, [pickingCenter, selectedType])

  // Cancel center pick on ESC
  useEffect(() => {
    if (!pickingCenter) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        usePlacementStore.getState().cancelPlacement()
        setPickingCenter(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickingCenter])

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

      <div className="flex gap-1 flex-wrap">
        {(['click', 'center', 'random', 'grid', 'distribute'] as PlacementMode[]).map((m) => (
          <button
            key={m}
            className={`rounded px-1.5 py-1 text-xs capitalize ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            onClick={() => { setMode(m); setPickingCenter(false) }}
          >{m === 'click' ? '📍' : m}</button>
        ))}
      </div>

      {mode !== 'click' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Qty</label>
          <input type="range" min={1} max={50} value={quantity} className="flex-1" onChange={(e) => setQuantity(Number(e.target.value))} />
          <span className="text-xs font-mono w-6 text-right">{quantity}</span>
        </div>
      )}

      {mode === 'distribute' && (
        <div className="flex flex-col gap-1.5 bg-muted/50 rounded p-2">
          <div className="flex gap-1">
            {(['uniform', 'gaussian', 'grid'] as DistMethod[]).map((m) => (
              <button key={m} className={`flex-1 rounded px-1 py-0.5 text-xs capitalize ${distMethod === m ? 'bg-accent' : ''}`} onClick={() => setDistMethod(m)}>{m}</button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground flex-shrink-0">Center</span>
            <input type="number" step={0.5} value={distCenterX} onChange={(e) => setDistCenterX(+e.target.value)} className="w-16 bg-background border rounded px-1 text-xs" />
            <input type="number" step={0.5} value={distCenterY} onChange={(e) => setDistCenterY(+e.target.value)} className="w-16 bg-background border rounded px-1 text-xs" />
            <button
              className={`rounded px-1.5 py-0.5 text-xs ${pickingCenter ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={handlePickCenter}
            >{pickingCenter ? '✓' : '🎯'}</button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground flex-shrink-0">± Range</span>
            <input type="number" step={0.5} min={0.1} value={distRangeX} onChange={(e) => setDistRangeX(+e.target.value)} className="w-16 bg-background border rounded px-1 text-xs" />
            <input type="number" step={0.5} min={0.1} value={distRangeY} onChange={(e) => setDistRangeY(+e.target.value)} className="w-16 bg-background border rounded px-1 text-xs" />
          </div>

          {distMethod === 'grid' && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground flex-shrink-0">Spacing</span>
              <input type="number" step={0.1} min={0.1} value={distSpacing} onChange={(e) => setDistSpacing(+e.target.value)} className="w-16 bg-background border rounded px-1 text-xs" />
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">{distPreview.length} ghost preview</div>
        </div>
      )}

      {placementActive && !pickingCenter ? (
        <button className="bg-muted rounded px-2 py-1.5 text-xs font-medium" onClick={() => usePlacementStore.getState().cancelPlacement()}>
          Cancel placement (ESC)
        </button>
      ) : pickingCenter ? (
        <div className="text-xs text-muted-foreground text-center">Click scene to set center...</div>
      ) : (
        <button
          className="bg-primary text-primary-foreground rounded px-2 py-1.5 text-xs font-medium disabled:opacity-50"
          disabled={!selectedType || (needsController && !controller)}
          onClick={handleSpawn}
        >
          {mode === 'click' ? `Place ${selectedType || '...'}` :
           mode === 'distribute' ? `Distribute ${quantity}× ${selectedType || '...'}` :
           `Spawn ${quantity > 1 ? `${quantity}×` : ''} ${selectedType || '...'}`}
        </button>
      )}
    </div>
  )
}
