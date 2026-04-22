import { useState, useCallback } from 'react'
import { useMetadataStore } from '@/stores/metadataStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import type { Vec3 } from '@/types/protocol'

interface SpawnConfig {
  type: string
  controller?: string
  size?: Vec3
  movable?: boolean
  mass?: number
  radius?: number
  height?: number
  id_prefix?: string
}

type PlacementMode = 'center' | 'random' | 'grid'

const ENTITY_DEFAULTS: Record<string, Partial<SpawnConfig>> = {
  'box': { size: { x: 0.3, y: 0.3, z: 0.3 }, movable: true, mass: 1.0 },
  'cylinder': { radius: 0.15, height: 0.5, movable: true, mass: 1.0 },
  'foot-bot': {},
  'kheperaiv': {},
}

function findClearSpot(entities: Map<string, any>, step: number): Vec3 {
  let x = 0, y = 0
  for (let i = 0; i < 100; i++) {
    const tooClose = Array.from(entities.values()).some(
      (e: any) => 'position' in e && Math.abs(e.position.x - x) < step && Math.abs(e.position.y - y) < step
    )
    if (!tooClose) break
    const angle = i * 2.4
    const r = step * Math.sqrt(i)
    x = r * Math.cos(angle)
    y = r * Math.sin(angle)
  }
  return { x, y, z: 0 }
}

function randomInArena(): Vec3 {
  const arena = useExperimentStore.getState().arena
  if (!arena) return { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4, z: 0 }
  const hw = arena.size.x / 2 * 0.8, hd = arena.size.y / 2 * 0.8
  return {
    x: arena.center.x + (Math.random() - 0.5) * 2 * hw,
    y: arena.center.y + (Math.random() - 0.5) * 2 * hd,
    z: 0,
  }
}

function gridPositions(quantity: number, spacing: number): Vec3[] {
  const cols = Math.ceil(Math.sqrt(quantity))
  const arena = useExperimentStore.getState().arena
  const cx = arena?.center.x ?? 0, cy = arena?.center.y ?? 0
  return Array.from({ length: quantity }, (_, i) => {
    const c = i % cols, r = Math.floor(i / cols)
    return {
      x: cx + (c - (cols - 1) / 2) * spacing,
      y: cy + (r - (Math.ceil(quantity / cols) - 1) / 2) * spacing,
      z: 0,
    }
  })
}

export function SpawnPalette() {
  const { entityTypes, controllers, loaded } = useMetadataStore()
  const [selectedType, setSelectedType] = useState('')
  const [controller, setController] = useState('')
  const [prefix, setPrefix] = useState('')
  const [mode, setMode] = useState<PlacementMode>('center')
  const [quantity, setQuantity] = useState(1)

  const isRobot = selectedType === 'foot-bot' || selectedType === 'kheperaiv'
  const needsController = isRobot && controllers.length > 0

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

    const positions: Vec3[] = []
    if (mode === 'center') {
      const entities = useExperimentStore.getState().entities
      for (let i = 0; i < quantity; i++) {
        positions.push(findClearSpot(entities, 0.3))
        // Temporarily add a fake entity so next iteration avoids this spot
        const pos = positions[positions.length - 1]
        entities.set(`__tmp_${i}`, { position: pos } as any)
      }
      // Clean up temp entries
      for (let i = 0; i < quantity; i++) entities.delete(`__tmp_${i}`)
    } else if (mode === 'random') {
      for (let i = 0; i < quantity; i++) positions.push(randomInArena())
    } else if (mode === 'grid') {
      positions.push(...gridPositions(quantity, 0.4))
    }

    for (const pos of positions) {
      useConnectionStore.getState().addEntity({ ...base, position: pos })
    }
  }, [selectedType, controller, prefix, mode, quantity, needsController])

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

      <div className="flex gap-1">
        {(['center', 'random', 'grid'] as PlacementMode[]).map((m) => (
          <button
            key={m}
            className={`flex-1 rounded px-2 py-1 text-xs capitalize ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            onClick={() => setMode(m)}
          >{m}</button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Qty</label>
        <input
          type="range" min={1} max={50} value={quantity}
          className="flex-1"
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <span className="text-xs font-mono w-6 text-right">{quantity}</span>
      </div>

      <button
        className="bg-primary text-primary-foreground rounded px-2 py-1.5 text-xs font-medium disabled:opacity-50"
        disabled={!selectedType || (needsController && !controller)}
        onClick={handleSpawn}
      >
        Spawn {quantity > 1 ? `${quantity}×` : ''} {selectedType || '...'}
      </button>
    </div>
  )
}
