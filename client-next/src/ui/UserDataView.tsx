import { useState } from 'react'
import { ChevronRight, ChevronDown, Pin } from 'lucide-react'

const MAX_DEPTH = 3

function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  if (typeof v === 'boolean') return v ? '✓' : '✗'
  if (typeof v === 'string') return v
  return String(v)
}

function Row({ label, value, onPin, pinned }: { label: string; value: string; onPin?: () => void; pinned?: boolean }) {
  return (
    <div className="flex items-baseline py-px group/row">
      <span className="text-[10px] text-muted-foreground truncate mr-2">{label}</span>
      <span className="text-[10px] font-mono text-right ml-auto">{value}</span>
      {onPin && (
        <button
          onClick={onPin}
          className={`ml-1 shrink-0 ${pinned ? 'text-yellow-500' : 'text-muted-foreground/0 group-hover/row:text-muted-foreground/60'} hover:text-yellow-500`}
          title={pinned ? 'Unpin from watch list' : 'Pin to watch list'}
        >
          <Pin className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

function CollapsibleRow({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-0.5 w-full py-px text-left">
        {open ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
        <span className="text-[10px] text-muted-foreground truncate mr-2">{label}</span>
        {!open && <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto">{summary}</span>}
      </button>
      {open && <div className="pl-3">{children}</div>}
    </div>
  )
}

function DataNode({ label, value, depth, onPin, pinned }: { label: string; value: unknown; depth: number; onPin?: () => void; pinned?: boolean }) {
  if (value === null || value === undefined) return <Row label={label} value="—" onPin={onPin} pinned={pinned} />

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return <Row label={label} value={`[${value.length} items]`} onPin={onPin} pinned={pinned} />
    return (
      <CollapsibleRow label={label} summary={`[${value.length}]`}>
        {value.map((item, i) => <DataNode key={i} label={String(i)} value={item} depth={depth + 1} />)}
      </CollapsibleRow>
    )
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (depth >= MAX_DEPTH) return <Row label={label} value={`{${keys.length} keys}`} onPin={onPin} pinned={pinned} />
    return (
      <CollapsibleRow label={label} summary={`{${keys.length}}`}>
        {keys.map((k) => <DataNode key={k} label={k} value={(value as Record<string, unknown>)[k]} depth={depth + 1} />)}
      </CollapsibleRow>
    )
  }

  return <Row label={label} value={formatScalar(value)} onPin={onPin} pinned={pinned} />
}

interface UserDataViewProps {
  data: unknown
  entityId?: string
  onPinField?: (field: string) => void
  isFieldPinned?: (field: string) => boolean
}

export function UserDataView({ data, entityId, onPinField, isFieldPinned }: UserDataViewProps) {
  if (data === null || data === undefined) return null
  if (typeof data !== 'object') return <Row label="value" value={formatScalar(data)} />

  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>)

  return (
    <div className="space-y-0">
      {entries.map(([k, v]) => (
        <DataNode
          key={k}
          label={k}
          value={v}
          depth={0}
          onPin={onPinField && entityId ? () => onPinField(k) : undefined}
          pinned={isFieldPinned ? isFieldPinned(k) : undefined}
        />
      ))}
    </div>
  )
}
