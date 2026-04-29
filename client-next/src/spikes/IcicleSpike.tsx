import { useMemo } from 'react'
import { hierarchy, partition, type HierarchyRectangularNode } from 'd3-hierarchy'
import { toHierarchy, buildHashMap, type FlatTreeData, type TreeNode } from './mockTreeData'

interface Props {
  treeA: FlatTreeData
  treeB: FlatTreeData
  width?: number
  height?: number
}

export function IcicleSpike({ treeA, treeB, width = 600, height = 300 }: Props) {
  const { nodesA, nodesB, hashMapB, hashMapA } = useMemo(() => {
    const rootA = toHierarchy(treeA)
    const rootB = toHierarchy(treeB)
    const hA = hierarchy(rootA).sum(() => 1)
    const hB = hierarchy(rootB).sum(() => 1)
    const p = partition<TreeNode>().size([width, height / 2]).padding(1)
    return {
      nodesA: p(hA).descendants(),
      nodesB: p(hB).descendants(),
      hashMapB: buildHashMap(treeB),
      hashMapA: buildHashMap(treeA),
    }
  }, [treeA, treeB, width, height])

  const diffColor = (node: HierarchyRectangularNode<TreeNode>, otherMap: Map<string, string>) => {
    const k = `${node.data.level}:${node.data.key}`
    const otherHash = otherMap.get(k)
    if (node.data.hash === 'virtual') return '#555'
    if (!otherHash) return '#888'
    return otherHash === node.data.hash ? '#4ade80' : '#f87171'
  }

  const renderNodes = (nodes: HierarchyRectangularNode<TreeNode>[], otherMap: Map<string, string>, yOffset: number) =>
    nodes.map((n, i) => {
      const w = n.y1 - n.y0
      const h = n.x1 - n.x0
      if (w < 2 || h < 2) return null
      return (
        <g key={i} transform={`translate(${n.y0},${n.x0 + yOffset})`}>
          <rect width={w} height={h} fill={diffColor(n, otherMap)} stroke="#1e1e2e" strokeWidth={0.5} rx={2} />
          {w > 30 && h > 12 && (
            <text x={4} y={h / 2 + 4} fontSize={10} fill="#1e1e2e" fontFamily="monospace">
              {n.data.key}
            </text>
          )}
        </g>
      )
    })

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-zinc-300">Spike 1: Icicle / Partition (d3-hierarchy)</h3>
      <p className="text-xs text-zinc-500 mb-2">
        Levels as columns, width = key coverage. <span className="text-green-400">Green</span> = match,{' '}
        <span className="text-red-400">Red</span> = divergent.
      </p>
      <svg width={width} height={height + 20} className="bg-zinc-900 rounded">
        <text x={4} y={12} fontSize={10} fill="#a1a1aa">Robot A</text>
        {renderNodes(nodesA, hashMapB, 16)}
        <text x={4} y={height / 2 + 12} fontSize={10} fill="#a1a1aa">Robot B</text>
        {renderNodes(nodesB, hashMapA, height / 2 + 16)}
      </svg>
    </div>
  )
}
