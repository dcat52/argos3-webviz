import { create } from 'zustand'

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface PanelState {
  open: boolean
  collapsed: boolean
  position: { x: number; y: number } | { pin: Corner }
  zIndex: number
}

interface PanelStore {
  panels: Record<string, PanelState>
  nextZ: number
  register: (id: string, defaults: Partial<PanelState>) => void
  toggle: (id: string) => void
  setOpen: (id: string, open: boolean) => void
  setCollapsed: (id: string, collapsed: boolean) => void
  setPosition: (id: string, pos: PanelState['position']) => void
  bringToFront: (id: string) => void
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  panels: {},
  nextZ: 100,
  register: (id, defaults) => set((s) => {
    if (s.panels[id]) return s
    return { panels: { ...s.panels, [id]: { open: true, collapsed: false, position: { pin: 'top-right' as Corner }, zIndex: s.nextZ, ...defaults } }, nextZ: s.nextZ + 1 }
  }),
  toggle: (id) => set((s) => {
    const p = s.panels[id]
    if (!p) return s
    return { panels: { ...s.panels, [id]: { ...p, open: !p.open } } }
  }),
  setOpen: (id, open) => set((s) => {
    const p = s.panels[id]
    if (!p) return s
    return { panels: { ...s.panels, [id]: { ...p, open } } }
  }),
  setCollapsed: (id, collapsed) => set((s) => {
    const p = s.panels[id]
    if (!p) return s
    return { panels: { ...s.panels, [id]: { ...p, collapsed } } }
  }),
  setPosition: (id, pos) => set((s) => {
    const p = s.panels[id]
    if (!p) return s
    return { panels: { ...s.panels, [id]: { ...p, position: pos } } }
  }),
  bringToFront: (id) => set((s) => {
    const p = s.panels[id]
    if (!p) return s
    return { panels: { ...s.panels, [id]: { ...p, zIndex: s.nextZ } }, nextZ: s.nextZ + 1 }
  }),
}))
