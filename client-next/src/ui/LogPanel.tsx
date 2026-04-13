import { useState, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLogStore } from '../stores/logStore'
import type { LogEntry } from '../types/protocol'

function LogList({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight)
  }, [entries.length])

  return (
    <div ref={ref} className="flex-1 overflow-y-auto font-mono text-[11px] p-1">
      {entries.map((e, i) => (
        <div key={i} className={e.log_type === 'LOGERR' ? 'text-red-400' : 'text-gray-400'}>
          <span className="text-gray-600 mr-2">[{e.step}]</span>{e.log_message}
        </div>
      ))}
    </div>
  )
}

export function LogPanel() {
  const [tab, setTab] = useState<'log' | 'errors'>('log')
  const { logs, errors, clear } = useLogStore(
    useShallow((s) => ({ logs: s.logs, errors: s.errors, clear: s.clear }))
  )

  const tabCls = (t: string) =>
    `px-2 py-0.5 text-xs rounded-t ${tab === t ? 'bg-white/10 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`

  return (
    <div className="h-full flex flex-col bg-[#12122a] border-t border-white/10">
      <div className="flex items-center gap-1 px-2 pt-1">
        <button className={tabCls('log')} onClick={() => setTab('log')}>Log</button>
        <button className={tabCls('errors')} onClick={() => setTab('errors')}>
          Errors {errors.length > 0 && <span className="text-red-400 ml-1">({errors.length})</span>}
        </button>
        <button onClick={clear} className="ml-auto text-[10px] text-gray-500 hover:text-gray-300">Clear</button>
      </div>
      <LogList entries={tab === 'log' ? logs : errors} />
    </div>
  )
}
