import { useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-1 w-full text-sm font-semibold py-2 group">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[panel-open]:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs shrink-0">{label}</Label>
      {children}
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer" />
    </Row>
  )
}

export function SettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useSettingsStore()
  const [draft, setDraft] = useState(s.wsUrl)

  const applyUrl = () => {
    s.set({ wsUrl: draft })
    useConnectionStore.getState().disconnect()
    useConnectionStore.getState().connect(draft)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center justify-between">
            Settings
            <Button variant="ghost" size="sm" className="text-xs" onClick={s.reset}>Reset All</Button>
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)] px-4">
          <div className="space-y-1 pb-4">

            <Section title="Connection">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">WebSocket URL</Label>
                <div className="flex gap-2">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="text-xs h-7" />
                  <Button size="sm" className="h-7 text-xs" onClick={applyUrl}>Connect</Button>
                </div>
              </div>
              <Row label="Reconnect interval (ms)">
                <Input type="number" value={s.reconnectIntervalMs} onChange={(e) => s.set({ reconnectIntervalMs: Number(e.target.value) })} className="w-20 h-7 text-xs" />
              </Row>
            </Section>

            <Section title="Rendering">
              <Row label="Shadows">
                <Switch checked={s.shadows} onCheckedChange={(v) => s.set({ shadows: v })} />
              </Row>
              <Row label="Pixel Ratio">
                <Select value={String(s.pixelRatio)} onValueChange={(v) => s.set({ pixelRatio: Number(v) })}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0.5, 1, 1.5, 2].map((v) => <SelectItem key={v} value={String(v)} className="text-xs">{v}×</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="FOV">
                <div className="flex items-center gap-2">
                  <Slider min={30} max={90} step={5} value={[s.fov]} onValueChange={([v]) => s.set({ fov: v })} className="w-24" />
                  <span className="text-xs text-muted-foreground w-6">{s.fov}°</span>
                </div>
              </Row>
            </Section>

            <Section title="Camera">
              <Row label="Min distance">
                <Input type="number" step="0.1" value={s.cameraMinDistance} onChange={(e) => s.set({ cameraMinDistance: Number(e.target.value) })} className="w-20 h-7 text-xs" />
              </Row>
              <Row label="Max distance (× arena)">
                <Input type="number" step="0.5" value={s.cameraMaxDistanceMultiplier} onChange={(e) => s.set({ cameraMaxDistanceMultiplier: Number(e.target.value) })} className="w-20 h-7 text-xs" />
              </Row>
              <Row label="Smooth time">
                <div className="flex items-center gap-2">
                  <Slider min={0} max={1} step={0.05} value={[s.cameraSmoothTime]} onValueChange={([v]) => s.set({ cameraSmoothTime: v })} className="w-24" />
                  <span className="text-xs text-muted-foreground w-8">{s.cameraSmoothTime}</span>
                </div>
              </Row>
            </Section>

            <Section title="Colors">
              <ColorRow label="Selection ring" value={s.selectionColor} onChange={(v) => s.set({ selectionColor: v })} />
              <Row label="Selection opacity">
                <div className="flex items-center gap-2">
                  <Slider min={0} max={1} step={0.1} value={[s.selectionOpacity]} onValueChange={([v]) => s.set({ selectionOpacity: v })} className="w-24" />
                  <span className="text-xs text-muted-foreground w-6">{s.selectionOpacity}</span>
                </div>
              </Row>
              <ColorRow label="Ray hit" value={s.rayHitColor} onChange={(v) => s.set({ rayHitColor: v })} />
              <ColorRow label="Ray miss" value={s.rayMissColor} onChange={(v) => s.set({ rayMissColor: v })} />
              <ColorRow label="Trail" value={s.trailColor} onChange={(v) => s.set({ trailColor: v })} />
            </Section>

            <Section title="Lighting">
              <Row label="Directional intensity">
                <div className="flex items-center gap-2">
                  <Slider min={0} max={2} step={0.1} value={[s.directionalIntensity]} onValueChange={([v]) => s.set({ directionalIntensity: v })} className="w-24" />
                  <span className="text-xs text-muted-foreground w-6">{s.directionalIntensity}</span>
                </div>
              </Row>
              <Row label="Hemisphere intensity">
                <div className="flex items-center gap-2">
                  <Slider min={0} max={2} step={0.1} value={[s.hemisphereIntensity]} onValueChange={([v]) => s.set({ hemisphereIntensity: v })} className="w-24" />
                  <span className="text-xs text-muted-foreground w-6">{s.hemisphereIntensity}</span>
                </div>
              </Row>
            </Section>

            <Section title="Limits">
              <Row label="Max log entries">
                <Input type="number" step="100" value={s.maxLogEntries} onChange={(e) => s.set({ maxLogEntries: Number(e.target.value) })} className="w-20 h-7 text-xs" />
              </Row>
              <Row label="Max event entries">
                <Input type="number" step="50" value={s.maxEventLogEntries} onChange={(e) => s.set({ maxEventLogEntries: Number(e.target.value) })} className="w-20 h-7 text-xs" />
              </Row>
            </Section>

            <Section title="Recording">
              <Row label="Capture FPS">
                <Select value={String(s.captureFps)} onValueChange={(v) => s.set({ captureFps: Number(v) })}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 24, 30, 60].map((v) => <SelectItem key={v} value={String(v)} className="text-xs">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Video bitrate (Mbps)">
                <Select value={String(s.videoBitrate)} onValueChange={(v) => s.set({ videoBitrate: Number(v) })}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[{ v: 2_000_000, l: '2' }, { v: 5_000_000, l: '5' }, { v: 10_000_000, l: '10' }, { v: 20_000_000, l: '20' }].map((o) => (
                      <SelectItem key={o.v} value={String(o.v)} className="text-xs">{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            </Section>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
