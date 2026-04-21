import { useState, useCallback } from 'react'

type GridLayout = '1x1' | '2x1' | '2x2' | '2x4'

const GRID_CSS: Record<GridLayout, string> = {
  '1x1': 'grid-cols-1 grid-rows-1',
  '2x1': 'grid-cols-2 grid-rows-1',
  '2x2': 'grid-cols-2 grid-rows-2',
  '2x4': 'grid-cols-2 grid-rows-4',
}

const PANE_COUNT: Record<GridLayout, number> = { '1x1': 1, '2x1': 2, '2x2': 4, '2x4': 8 }

interface Pane {
  id: number
  url: string
}

export function Dashboard() {
  const [layout, setLayout] = useState<GridLayout>('2x2')
  const [panes, setPanes] = useState<Pane[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({ id: i, url: '' }))
  )

  const updateUrl = useCallback((id: number, url: string) => {
    setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, url } : p)))
  }, [])

  const visiblePanes = panes.slice(0, PANE_COUNT[layout])

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-10 flex items-center gap-2 px-3 border-b border-border shrink-0">
        <span className="text-sm font-medium mr-2">Dashboard</span>
        {(Object.keys(GRID_CSS) as GridLayout[]).map((g) => (
          <button
            key={g}
            onClick={() => setLayout(g)}
            className={`px-2 py-0.5 text-xs rounded ${layout === g ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className={`flex-1 grid gap-1 p-1 ${GRID_CSS[layout]}`}>
        {visiblePanes.map((pane) => (
          <PaneCell key={pane.id} pane={pane} onUrlChange={updateUrl} />
        ))}
      </div>
    </div>
  )
}

function PaneCell({ pane, onUrlChange }: { pane: Pane; onUrlChange: (id: number, url: string) => void }) {
  const [editing, setEditing] = useState(!pane.url)
  const [draft, setDraft] = useState(pane.url)

  const commit = () => {
    onUrlChange(pane.id, draft)
    setEditing(false)
  }

  if (!pane.url || editing) {
    return (
      <div className="border border-border rounded flex items-center justify-center bg-muted/30">
        <form onSubmit={(e) => { e.preventDefault(); commit() }} className="flex gap-1">
          <input
            className="px-2 py-1 text-xs border rounded bg-background w-56"
            placeholder="ws://host:port"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <button type="submit" className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
            Connect
          </button>
        </form>
      </div>
    )
  }

  const src = `${window.location.pathname}?mode=viewer&ws=${encodeURIComponent(pane.url)}`

  return (
    <div className="relative border border-border rounded overflow-hidden">
      <iframe src={src} className="w-full h-full border-0" title={`Pane ${pane.id}`} />
      <button
        onClick={() => setEditing(true)}
        className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] bg-black/60 text-white rounded hover:bg-black/80"
      >
        ✎
      </button>
    </div>
  )
}
