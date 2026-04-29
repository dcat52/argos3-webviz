import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { smallTreeA, smallTreeB, wideTreeA, wideTreeB } from './mockTreeData'
import { IcicleSpike } from './IcicleSpike'
import { NodeLinkSpike } from './NodeLinkSpike'
import { TreemapSpike } from './TreemapSpike'
import { PlainSvgSpike } from './PlainSvgSpike'
import '@fontsource-variable/geist'
import '../index.css'

function SpikeApp() {
  const [useWide, setUseWide] = useState(false)
  const treeA = useWide ? wideTreeA : smallTreeA
  const treeB = useWide ? wideTreeB : smallTreeB

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <h1 className="text-xl font-bold mb-1">PN-004: Tree Visualization Spikes</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Comparing layout approaches for Prolly tree diff visualization.
        Same mock data rendered four ways.
      </p>

      <label className="flex items-center gap-2 mb-6 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={useWide}
          onChange={(e) => setUseWide(e.target.checked)}
          className="rounded"
        />
        Wide tree (32 keys, branching ~8) — tests how layouts handle real-world width
      </label>

      <div className="grid gap-8">
        <IcicleSpike treeA={treeA} treeB={treeB} width={800} height={useWide ? 500 : 300} />
        <NodeLinkSpike treeA={treeA} treeB={treeB} width={800} height={useWide ? 600 : 400} />
        <TreemapSpike treeA={treeA} treeB={treeB} width={800} height={useWide ? 500 : 400} />
        <PlainSvgSpike treeA={treeA} treeB={treeB} width={800} height={useWide ? 400 : 300} />
      </div>

      <div className="mt-8 p-4 bg-zinc-900 rounded text-sm text-zinc-400">
        <h2 className="font-semibold text-zinc-200 mb-2">Evaluation Notes</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">Approach</th>
              <th className="pb-1">Diff Clarity</th>
              <th className="pb-1">Wide Tree</th>
              <th className="pb-1">Complexity</th>
              <th className="pb-1">New Deps</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr><td>Icicle (d3 partition)</td><td>High — aligned columns</td><td>Good</td><td>~65 lines</td><td>d3-hierarchy</td></tr>
            <tr><td>Node-Link (d3 tree)</td><td>Medium — circles</td><td>Poor — very wide</td><td>~80 lines</td><td>d3-hierarchy</td></tr>
            <tr><td>Treemap (d3 treemap)</td><td>Low — no hierarchy visible</td><td>OK</td><td>~70 lines</td><td>d3-hierarchy</td></tr>
            <tr><td>Plain SVG (no lib)</td><td>High — simple rows</td><td>Good</td><td>~95 lines</td><td>None</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<SpikeApp />)
