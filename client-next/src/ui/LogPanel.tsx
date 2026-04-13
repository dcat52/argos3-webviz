import { useRef, useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { useLogStore } from '../stores/logStore'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { LogEntry } from '../types/protocol'

function LogList({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight) }, [entries.length])
  return (
    <ScrollArea className="h-full">
      <div ref={ref} className="p-2 font-mono text-[11px] space-y-0.5">
        {entries.length === 0 && <div className="text-muted-foreground text-center py-4">No entries</div>}
        {entries.map((e, i) => (
          <div key={i} className={e.log_type === 'LOGERR' ? 'text-destructive' : 'text-muted-foreground'}>
            <span className="text-muted-foreground/50 mr-2">[{e.step}]</span>{e.log_message}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

export function LogPanel() {
  const { logs, errors, clear } = useLogStore(useShallow((s) => ({ logs: s.logs, errors: s.errors, clear: s.clear })))

  return (
    <div className="h-full flex flex-col bg-card border-t">
      <Tabs defaultValue="log" className="flex flex-col h-full">
        <div className="flex items-center px-2 pt-1">
          <TabsList className="h-7">
            <TabsTrigger value="log" className="text-xs px-2 py-0.5">Log</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs px-2 py-0.5">
              Errors
              {errors.length > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">{errors.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs text-muted-foreground" onClick={clear}>
            Clear
          </Button>
        </div>
        <TabsContent value="log" className="flex-1 mt-0"><LogList entries={logs} /></TabsContent>
        <TabsContent value="errors" className="flex-1 mt-0"><LogList entries={errors} /></TabsContent>
      </Tabs>
    </div>
  )
}
