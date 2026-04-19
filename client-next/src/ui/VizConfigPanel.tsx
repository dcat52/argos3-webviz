import { useRef } from 'react'
import { useShallow } from 'zustand/shallow'
import { useVizConfigStore, type VizConfig } from '@/stores/vizConfigStore'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ChevronRight, Download, Upload } from 'lucide-react'
import type { FieldSchema } from '@/lib/vizEngine'
import { vizPresets, getAvailablePresets } from '@/lib/vizPresets'
import { VIZ_DEFAULTS } from '@/lib/defaults'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 w-full text-xs font-semibold uppercase text-muted-foreground py-1 group">
        <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-2 pb-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function FieldSelect({ value, onChange, fields, typeFilter }: { value: string; onChange: (v: string) => void; fields: FieldSchema[]; typeFilter?: FieldSchema['type'][] }) {
  const filtered = typeFilter ? fields.filter((f) => typeFilter.includes(f.type)) : fields
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
      <SelectContent>
        {filtered.map((f) => <SelectItem key={f.fieldName} value={f.fieldName}>{f.fieldName} ({f.type})</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer" />
}

export function VizConfigPanel() {
  const { fields, config, setConfig, loadPreset, exportConfig, importConfig } = useVizConfigStore(
    useShallow((s) => ({ fields: s.fields, config: s.config, setConfig: s.setConfig, loadPreset: s.loadPreset, exportConfig: s.exportConfig, importConfig: s.importConfig }))
  )
  const importRef = useRef<HTMLInputElement>(null)

  const availablePresets = getAvailablePresets(fields.map(f => f.fieldName))

  const handleExport = () => {
    const json = exportConfig()
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'vizconfig.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) file.text().then(importConfig)
  }

  const updateColorBy = (patch: Partial<NonNullable<VizConfig['colorBy']>>) =>
    setConfig({ colorBy: { enabled: false, field: '', scale: 'linear', colorA: VIZ_DEFAULTS.colorByColorA, colorB: VIZ_DEFAULTS.colorByColorB, ...config.colorBy, ...patch } })

  const updateLinks = (patch: Partial<NonNullable<VizConfig['links']>>) =>
    setConfig({ links: { enabled: false, field: '', color: VIZ_DEFAULTS.linksColor, opacity: VIZ_DEFAULTS.linksOpacity, ...config.links, ...patch } })

  return (
    <div className="p-3 space-y-1">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-1 w-full text-xs font-semibold uppercase text-muted-foreground py-1 group mb-2">
          <ChevronRight className="h-3 w-3 transition-transform group-data-[panel-open]:rotate-90" />
          Visualization
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1">

      <Section title="Presets">
        <Select onValueChange={(id) => {
          const preset = vizPresets.find(p => p.id === id)
          if (preset) loadPreset(preset.config)
        }}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select preset" /></SelectTrigger>
          <SelectContent>
            {availablePresets.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => importRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Import
          </Button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </Section>

      <Section title="Color By">
        <div className="flex items-center gap-2">
          <Switch checked={config.colorBy?.enabled ?? false} onCheckedChange={(v) => updateColorBy({ enabled: v })} />
          <Label className="text-xs">Enable</Label>
        </div>
        <FieldSelect value={config.colorBy?.field ?? ''} onChange={(v) => updateColorBy({ field: v })} fields={fields} typeFilter={['number', 'string']} />
        <div className="flex items-center gap-2">
          <Select value={config.colorBy?.scale ?? 'linear'} onValueChange={(v) => updateColorBy({ scale: v as 'linear' | 'categorical' })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="categorical">Categorical</SelectItem>
            </SelectContent>
          </Select>
          <ColorInput value={config.colorBy?.colorA ?? '#0000ff'} onChange={(v) => updateColorBy({ colorA: v })} />
          <ColorInput value={config.colorBy?.colorB ?? '#ff0000'} onChange={(v) => updateColorBy({ colorB: v })} />
        </div>
      </Section>

      <Section title="Links">
        <div className="flex items-center gap-2">
          <Switch checked={config.links?.enabled ?? false} onCheckedChange={(v) => updateLinks({ enabled: v })} />
          <Label className="text-xs">Enable</Label>
        </div>
        <FieldSelect value={config.links?.field ?? ''} onChange={(v) => updateLinks({ field: v })} fields={fields} typeFilter={['array']} />
        <div className="flex items-center gap-2">
          <ColorInput value={config.links?.color ?? '#44aaff'} onChange={(v) => updateLinks({ color: v })} />
          <Label className="text-xs">Opacity</Label>
          <Slider min={0} max={1} step={0.1} value={[config.links?.opacity ?? 0.6]} onValueChange={([v]) => updateLinks({ opacity: v })} className="flex-1" />
        </div>
      </Section>

      <Section title="Labels">
        {fields.map((f) => {
          const active = config.labels.find((l) => l.field === f.fieldName)
          return (
            <div key={f.fieldName} className="flex items-center gap-2">
              <Switch
                checked={active?.enabled ?? false}
                onCheckedChange={(v) => {
                  const next = config.labels.filter((l) => l.field !== f.fieldName)
                  if (v) next.push({ enabled: true, field: f.fieldName })
                  setConfig({ labels: next })
                }}
              />
              <Label className="text-xs">{f.fieldName}</Label>
            </div>
          )
        })}
      </Section>

      <Section title="Trails">
        <div className="flex items-center gap-2">
          <Switch checked={config.trails.enabled} onCheckedChange={(v) => setConfig({ trails: { ...config.trails, enabled: v } })} />
          <Label className="text-xs">Enable</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Length</Label>
          <Slider min={10} max={200} step={10} value={[config.trails.length]} onValueChange={([v]) => setConfig({ trails: { ...config.trails, length: v } })} className="flex-1" />
          <span className="text-xs text-muted-foreground w-6">{config.trails.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Opacity</Label>
          <Slider min={0} max={1} step={0.1} value={[config.trails.opacity]} onValueChange={([v]) => setConfig({ trails: { ...config.trails, opacity: v } })} className="flex-1" />
        </div>
      </Section>

      <Section title="Heatmap">
        <div className="flex items-center gap-2">
          <Switch checked={config.heatmap.enabled} onCheckedChange={(v) => setConfig({ heatmap: { ...config.heatmap, enabled: v } })} />
          <Label className="text-xs">Enable</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Decay</Label>
          <Slider min={0.9} max={1} step={0.005} value={[config.heatmap.decay]} onValueChange={([v]) => setConfig({ heatmap: { ...config.heatmap, decay: v } })} className="flex-1" />
          <span className="text-xs text-muted-foreground w-8">{config.heatmap.decay.toFixed(3)}</span>
        </div>
        <div className="flex items-center gap-2">
          <ColorInput value={config.heatmap.colorA} onChange={(v) => setConfig({ heatmap: { ...config.heatmap, colorA: v } })} />
          <ColorInput value={config.heatmap.colorB} onChange={(v) => setConfig({ heatmap: { ...config.heatmap, colorB: v } })} />
        </div>
      </Section>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
