import { useState, useEffect } from 'react'
import { usePlacementStore } from '@/stores/placementStore'
import { EntityPicker, ENTITY_DEFAULTS, isRobotType } from './EntityPicker'
import { useMetadataStore } from '@/stores/metadataStore'

export function PlaceParams() {
  const [selectedType, setSelectedType] = useState('')
  const [controller, setController] = useState('')
  const [prefix, setPrefix] = useState('')
  const controllers = useMetadataStore((s) => s.controllers)
  const placementActive = usePlacementStore((s) => s.active)

  const needsController = isRobotType(selectedType) && controllers.length > 0
  const canPlace = selectedType && (!needsController || controller)

  // Auto-activate placement when config is valid
  useEffect(() => {
    if (canPlace) {
      usePlacementStore.getState().startPlacement({
        type: selectedType,
        controller: needsController ? controller : undefined,
        id_prefix: prefix || selectedType,
        ...ENTITY_DEFAULTS[selectedType],
      })
    } else {
      usePlacementStore.getState().cancelPlacement()
    }
  }, [selectedType, controller, prefix, canPlace, needsController])

  return (
    <div className="bg-card/90 backdrop-blur border rounded-lg shadow-lg px-3 py-2 flex items-center gap-3 text-xs">
      <EntityPicker selectedType={selectedType} controller={controller} onTypeChange={setSelectedType} onControllerChange={setController} />
      <input className="bg-background border rounded px-1.5 py-1 text-xs w-24" placeholder="ID prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
      {placementActive && <span className="text-muted-foreground">Click to place · ESC to cancel</span>}
      {!canPlace && <span className="text-muted-foreground">Select type{needsController ? ' + controller' : ''} to place</span>}
    </div>
  )
}
