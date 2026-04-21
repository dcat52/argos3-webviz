import { useState, useCallback } from 'react'
import { useMetadataStore } from '@/stores/metadataStore'
import { useConnectionStore } from '@/stores/connectionStore'
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

interface SpawnPaletteProps {
  onStartPlacement: (config: SpawnConfig) => void
  onCancel: () => void
  active: boolean
}

const ENTITY_DEFAULTS: Record<string, Partial<SpawnConfig>> = {
  'box': { size: { x: 0.3, y: 0.3, z: 0.3 }, movable: true, mass: 1.0 },
  'cylinder': { radius: 0.15, height: 0.5, movable: true, mass: 1.0 },
  'foot-bot': {},
  'kheperaiv': {},
}

export function SpawnPalette({ onStartPlacement, onCancel, active }: SpawnPaletteProps) {
  const { entityTypes, controllers, loaded } = useMetadataStore()
  const [selectedType, setSelectedType] = useState<string>('')
  const [controller, setController] = useState<string>('')
  const [prefix, setPrefix] = useState<string>('')

  const isRobot = selectedType === 'foot-bot' || selectedType === 'kheperaiv'
  const needsController = isRobot && controllers.length > 0

  const handlePlace = useCallback(() => {
    if (!selectedType) return
    if (needsController && !controller) return
    onStartPlacement({
      type: selectedType,
      controller: needsController ? controller : undefined,
      id_prefix: prefix || selectedType,
      ...ENTITY_DEFAULTS[selectedType],
    })
  }, [selectedType, controller, prefix, needsController, onStartPlacement])

  if (!loaded) return <div className="text-xs text-muted-foreground p-2">Loading metadata...</div>

  return (
    <div className="flex flex-col gap-2 p-2 text-sm">
      <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Spawn Entity</div>

      <select
        className="bg-background border rounded px-2 py-1 text-sm"
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
      >
        <option value="">Select type...</option>
        {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      {needsController && (
        <select
          className="bg-background border rounded px-2 py-1 text-sm"
          value={controller}
          onChange={(e) => setController(e.target.value)}
        >
          <option value="">Select controller...</option>
          {controllers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <input
        className="bg-background border rounded px-2 py-1 text-sm"
        placeholder="ID prefix (optional)"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
      />

      <div className="flex gap-1">
        <button
          className="flex-1 bg-primary text-primary-foreground rounded px-2 py-1 text-xs disabled:opacity-50"
          disabled={!selectedType || (needsController && !controller)}
          onClick={handlePlace}
        >
          {active ? 'Click to place...' : 'Place'}
        </button>
        {active && (
          <button
            className="bg-muted rounded px-2 py-1 text-xs"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export function useSpawnPlacement() {
  const [config, setConfig] = useState<SpawnConfig | null>(null)

  const startPlacement = useCallback((c: SpawnConfig) => setConfig(c), [])
  const cancelPlacement = useCallback(() => setConfig(null), [])

  const placeAt = useCallback((pos: Vec3) => {
    if (!config) return
    useConnectionStore.getState().addEntity({
      type: config.type,
      id_prefix: config.id_prefix ?? config.type,
      position: pos,
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      controller: config.controller,
      size: config.size,
      movable: config.movable,
      mass: config.mass,
      radius: config.radius,
      height: config.height,
    })
  }, [config])

  return { config, startPlacement, cancelPlacement, placeAt, active: config !== null }
}
