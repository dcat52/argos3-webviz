import { useMetadataStore } from '@/stores/metadataStore'

export const ENTITY_DEFAULTS: Record<string, Record<string, unknown>> = {
  'box': { size: { x: 0.3, y: 0.3, z: 0.3 }, movable: true, mass: 1.0 },
  'cylinder': { radius: 0.15, height: 0.5, movable: true, mass: 1.0 },
  'foot-bot': {},
  'kheperaiv': {},
}

export function isRobotType(type: string) {
  return type === 'foot-bot' || type === 'kheperaiv'
}

/** Compact inline entity type + controller picker for floating toolbars */
export function EntityPicker({ selectedType, controller, onTypeChange, onControllerChange }: {
  selectedType: string
  controller: string
  onTypeChange: (type: string) => void
  onControllerChange: (controller: string) => void
}) {
  const { entityTypes, controllers } = useMetadataStore()
  const needsController = isRobotType(selectedType) && controllers.length > 0

  return (
    <>
      <select className="bg-background border rounded px-1.5 py-1 text-xs" value={selectedType} onChange={(e) => onTypeChange(e.target.value)}>
        <option value="">Type...</option>
        {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {needsController && (
        <select className="bg-background border rounded px-1.5 py-1 text-xs" value={controller} onChange={(e) => onControllerChange(e.target.value)}>
          <option value="">Controller...</option>
          {controllers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </>
  )
}
