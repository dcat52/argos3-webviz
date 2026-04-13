import { useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export function SettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { wsUrl, shadows, pixelRatio, setWsUrl, setShadows, setPixelRatio } = useSettingsStore()
  const [draft, setDraft] = useState(wsUrl)

  const applyUrl = () => {
    setWsUrl(draft)
    useConnectionStore.getState().disconnect()
    useConnectionStore.getState().connect(draft)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">WebSocket URL</Label>
            <div className="flex gap-2">
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="text-xs" />
              <Button size="sm" onClick={applyUrl}>Connect</Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Shadows</Label>
            <Switch checked={shadows} onCheckedChange={setShadows} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Pixel Ratio</Label>
            <Select value={String(pixelRatio)} onValueChange={(v) => setPixelRatio(Number(v))}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5" className="text-xs">0.5x</SelectItem>
                <SelectItem value="1" className="text-xs">1x</SelectItem>
                <SelectItem value="1.5" className="text-xs">1.5x</SelectItem>
                <SelectItem value="2" className="text-xs">2x</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
