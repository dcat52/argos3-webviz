import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { usePanelStore, type Corner } from '@/stores/panelStore'
import { ChevronDown, ChevronRight, X } from 'lucide-react'

const SNAP = 8
const CORNER_CSS: Record<Corner, string> = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
}

interface Props {
  id: string
  title: string
  defaultPosition?: { pin: Corner } | { x: number; y: number }
  initialOpen?: boolean
  closable?: boolean
  children: ReactNode
}

export function FloatingPanel({ id, title, defaultPosition, initialOpen = true, closable = true, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  const panel = usePanelStore((s) => s.panels[id])
  const register = usePanelStore((s) => s.register)
  const setPosition = usePanelStore((s) => s.setPosition)
  const setCollapsed = usePanelStore((s) => s.setCollapsed)
  const setOpen = usePanelStore((s) => s.setOpen)
  const bringToFront = usePanelStore((s) => s.bringToFront)

  useEffect(() => {
    register(id, { position: defaultPosition ?? { pin: 'top-right' }, open: initialOpen })
  }, [id, register, defaultPosition])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    bringToFront(id)
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragStart.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top }
    titleRef.current?.setPointerCapture(e.pointerId)
  }, [id, bringToFront])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragStart.current
    if (!ds) return
    const x = ds.px + (e.clientX - ds.mx)
    const y = ds.py + (e.clientY - ds.my)

    const parent = ref.current?.parentElement
    if (!parent) return
    const pr = parent.getBoundingClientRect()
    const w = pr.width
    const h = pr.height

    // Snap to corners
    if (x < SNAP && y < SNAP) { setPosition(id, { pin: 'top-left' }); return }
    if (x + (ref.current?.offsetWidth ?? 0) > w - SNAP && y < SNAP) { setPosition(id, { pin: 'top-right' }); return }
    if (x < SNAP && y + (ref.current?.offsetHeight ?? 0) > h - SNAP) { setPosition(id, { pin: 'bottom-left' }); return }
    if (x + (ref.current?.offsetWidth ?? 0) > w - SNAP && y + (ref.current?.offsetHeight ?? 0) > h - SNAP) { setPosition(id, { pin: 'bottom-right' }); return }

    setPosition(id, { x, y })
  }, [id, setPosition])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragStart.current = null
    titleRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  if (!panel || !panel.open) return null

  const isPinned = 'pin' in panel.position
  const style: React.CSSProperties = isPinned
    ? { zIndex: panel.zIndex }
    : { left: (panel.position as { x: number; y: number }).x, top: (panel.position as { x: number; y: number }).y, zIndex: panel.zIndex }

  const posClass = isPinned ? CORNER_CSS[(panel.position as { pin: Corner }).pin] : ''

  return (
    <div
      ref={ref}
      className={`absolute pointer-events-auto ${posClass} min-w-[180px] rounded-lg border bg-card/95 backdrop-blur-sm shadow-lg`}
      style={style}
      onPointerDown={(e) => { e.stopPropagation(); bringToFront(id) }}
    >
      <div
        ref={titleRef}
        className="flex items-center gap-1 px-2 py-1 cursor-grab active:cursor-grabbing select-none border-b bg-muted/50 rounded-t-lg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <button onClick={() => setCollapsed(id, !panel.collapsed)} className="text-muted-foreground hover:text-foreground">
          {panel.collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">{title}</span>
        {closable && (
          <button onClick={() => setOpen(id, false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {!panel.collapsed && (
        <div className="p-2 text-xs space-y-1 overflow-auto">
          {children}
        </div>
      )}
    </div>
  )
}
