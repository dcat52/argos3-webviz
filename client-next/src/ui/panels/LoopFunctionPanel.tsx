import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '@/stores/experimentStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { FloatingPanel } from '../FloatingPanel'
import type { UIControl } from '@/types/protocol'

function ButtonControl({ ctrl }: { ctrl: Extract<UIControl, { type: 'button' }> }) {
  const send = useConnectionStore((s) => s.send)
  return (
    <button
      onClick={() => send({ command: 'ui_action', control_id: ctrl.id })}
      className="w-full text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/80"
    >
      {ctrl.label}
    </button>
  )
}

function SliderControl({ ctrl }: { ctrl: Extract<UIControl, { type: 'slider' }> }) {
  const send = useConnectionStore((s) => s.send)
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between">
        <span className="text-[10px] text-muted-foreground">{ctrl.label}</span>
        <span className="text-[10px] font-mono">{ctrl.value}</span>
      </div>
      <input
        type="range"
        min={ctrl.min}
        max={ctrl.max}
        value={ctrl.value}
        onChange={(e) => send({ command: 'ui_action', control_id: ctrl.id, value: Number(e.target.value) })}
        className="w-full h-1 accent-primary"
      />
    </div>
  )
}

function ToggleControl({ ctrl }: { ctrl: Extract<UIControl, { type: 'toggle' }> }) {
  const send = useConnectionStore((s) => s.send)
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-[10px] text-muted-foreground">{ctrl.label}</span>
      <input
        type="checkbox"
        checked={ctrl.value}
        onChange={(e) => send({ command: 'ui_action', control_id: ctrl.id, value: e.target.checked })}
        className="accent-primary"
      />
    </label>
  )
}

function DropdownControl({ ctrl }: { ctrl: Extract<UIControl, { type: 'dropdown' }> }) {
  const send = useConnectionStore((s) => s.send)
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] text-muted-foreground">{ctrl.label}</span>
      <select
        value={ctrl.value}
        onChange={(e) => send({ command: 'ui_action', control_id: ctrl.id, value: e.target.value })}
        className="w-full text-xs bg-muted border border-border rounded px-1 py-0.5"
      >
        {ctrl.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

export function LoopFunctionPanel() {
  const uiControls = useExperimentStore(useShallow((s) => s.uiControls))

  if (!uiControls || uiControls.length === 0) return null

  return (
    <FloatingPanel id="loop-functions" title="Controls" defaultPosition={{ pin: 'top-right' }}>
      <div className="w-56 max-h-[50vh] overflow-auto p-2 space-y-2">
        {uiControls.map((ctrl) => {
          switch (ctrl.type) {
            case 'button': return <ButtonControl key={ctrl.id} ctrl={ctrl} />
            case 'slider': return <SliderControl key={ctrl.id} ctrl={ctrl} />
            case 'toggle': return <ToggleControl key={ctrl.id} ctrl={ctrl} />
            case 'dropdown': return <DropdownControl key={ctrl.id} ctrl={ctrl} />
            default: return null
          }
        })}
      </div>
    </FloatingPanel>
  )
}
