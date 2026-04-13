import { useShallow } from 'zustand/react/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import type { AnyEntity, Vec3, Quaternion } from '../types/protocol'

function fmtVec3(v: Vec3) {
  return `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`
}

function fmtQuat(q: Quaternion) {
  return `(${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)})`
}

function Inspector({ entity }: { entity: AnyEntity }) {
  if (!('position' in entity)) return null
  const row = 'flex justify-between text-xs py-0.5'
  return (
    <div className="p-2 border-b border-white/10">
      <h3 className="text-xs font-semibold text-gray-300 mb-1">Inspector</h3>
      <div className={row}><span className="text-gray-500">ID</span><span className="text-gray-300">{entity.id}</span></div>
      <div className={row}><span className="text-gray-500">Type</span><span className="text-gray-300">{entity.type}</span></div>
      <div className={row}><span className="text-gray-500">Position</span><span className="text-gray-300 font-mono">{fmtVec3(entity.position)}</span></div>
      <div className={row}><span className="text-gray-500">Orientation</span><span className="text-gray-300 font-mono">{fmtQuat(entity.orientation)}</span></div>
      {'leds' in entity && entity.leds && (
        <div className={row}><span className="text-gray-500">LEDs</span><span className="text-gray-300">{entity.leds.length}</span></div>
      )}
      {entity.user_data !== undefined && (
        <div className="text-xs mt-1">
          <span className="text-gray-500">User Data</span>
          <pre className="text-gray-400 text-[10px] mt-0.5 overflow-auto max-h-24">{JSON.stringify(entity.user_data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { entities, selectedEntityId, selectEntity } = useExperimentStore(
    useShallow((s) => ({
      entities: s.entities,
      selectedEntityId: s.selectedEntityId,
      selectEntity: s.selectEntity,
    }))
  )

  const selected = selectedEntityId ? entities.get(selectedEntityId) : undefined

  return (
    <div className="h-full flex flex-col bg-[#12122a] text-gray-300 overflow-hidden">
      {selected && <Inspector entity={selected} />}
      <div className="flex-1 overflow-y-auto p-2">
        <h3 className="text-xs font-semibold text-gray-400 mb-1">Entities ({entities.size})</h3>
        {Array.from(entities.values()).map((e) => (
          <button
            key={e.id}
            onClick={() => selectEntity(e.id)}
            className={`block w-full text-left text-xs px-2 py-0.5 rounded truncate ${
              e.id === selectedEntityId ? 'bg-white/15 text-white' : 'hover:bg-white/5'
            }`}
          >
            {e.id} <span className="text-gray-500">({e.type})</span>
          </button>
        ))}
      </div>
    </div>
  )
}
