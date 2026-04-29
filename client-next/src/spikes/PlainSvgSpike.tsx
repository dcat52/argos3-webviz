import { useMemo } from 'react'
import { buildHashMap, type FlatTreeData } from './mockTreeData'

interface Props {
  treeA: FlatTreeData
  treeB: FlatTreeData
  width?: number
  height?: number
}

/** Hand-rolled icicle: no d3 layout, just group by level and draw rects */
export function PlainSvgSpike({ treeA, treeB, width = 600, height = 300 }: Props) {
  const halfH = height / 2 - 16

  const layout = useMemo(() => {
    function computeRects(flat: FlatTreeData, w: number, h: number) {
      const byLevel = new Map<number, typeof flat.tree_nodes>()
      for (const n of flat.tree_nodes) {
        const list = byLevel.get(n.level) ?? []
        list.push(n)
        byLevel.set(n.level, list)
      }
      const levels = flat.max_level + 1
      const rowH = h / levels
      const rects: { x: number; y: number; w: number; h: number; key: string; hash: string; level: number }[] = []

      for (let lvl = flat.max_level; lvl >= 0; lvl--) {
        const nodes = byLevel.get(lvl) ?? []
        const cellW = w / nodes.length
        nodes.forEach((n, i) => {
          rects.push({
            x: i * cellW,
            y: (flat.max_level - lvl) * rowH,
            w: cellW,
            h: rowH,
            key: n.key,
            hash: n.hash,
            level: n.level,
          })
        })
      }
      return rects
    }
    return {
      rectsA: computeRects(treeA, width, halfH),
      rectsB: computeRects(treeB, width, halfH),
      hashMapB: buildHashMap(treeB),
      hashMapA: buildHashMap(treeA),
    }
  }, [treeA, treeB, width, halfH])

  const diffColor = (level: number, key: string, hash: string, otherMap: Map<string, string>) => {
    const otherHash = otherMap.get(`${level}:${key}`)
    if (!otherHash) return '#888'
    return otherHash === hash ? '#4ade80' : '#f87171'
  }

  const renderRects = (rects: typeof layout.rectsA, otherMap: Map<string, string>, yOffset: number) =>
    rects.map((r, i) => (
      <g key={i} transform={`translate(${r.x},${r.y + yOffset})`}>
        <rect
          width={Math.max(0, r.w - 2)}
          height={Math.max(0, r.h - 2)}
          fill={diffColor(r.level, r.key, r.hash, otherMap)}
          stroke="#1e1e2e"
          strokeWidth={0.5}
          rx={2}
        />
        {r.w > 28 && r.h > 14 && (
          <text x={4} y={r.h / 2 + 3} fontSize={9} fill="#1e1e2e" fontFamily="monospace">
            {r.key}
          </text>
        )}
        {r.w > 60 && r.h > 14 && (
          <text x={r.w - 6} y={r.h / 2 + 3} fontSize={7} fill="#1e1e2e" fontFamily="monospace" textAnchor="end">
            {r.hash.slice(0, 6)}
          </text>
        )}
      </g>
    ))

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-zinc-300">Spike 4: Plain SVG (no library)</h3>
      <p className="text-xs text-zinc-500 mb-2">
        Hand-rolled level rows. Root at top, leaves at bottom. <span className="text-green-400">Green</span> = match,{' '}
        <span className="text-red-400">Red</span> = divergent.
      </p>
      <svg width={width} height={height} className="bg-zinc-900 rounded">
        <text x={4} y={12} fontSize={10} fill="#a1a1aa">Robot A</text>
        {renderRects(layout.rectsA, layout.hashMapB, 16)}
        <text x={4} y={halfH + 22} fontSize={10} fill="#a1a1aa">Robot B</text>
        {renderRects(layout.rectsB, layout.hashMapA, halfH + 28)}
      </svg>
    </div>
  )
}
