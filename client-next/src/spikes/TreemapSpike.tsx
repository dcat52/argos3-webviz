import { useMemo } from 'react'
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy'
import { toHierarchy, buildHashMap, type FlatTreeData, type TreeNode } from './mockTreeData'

interface Props {
  treeA: FlatTreeData
  treeB: FlatTreeData
  width?: number
  height?: number
}

export function TreemapSpike({ treeA, treeB, width = 600, height = 400 }: Props) {
  const halfH = height / 2 - 16

  const { nodesA, nodesB, hashMapB, hashMapA } = useMemo(() => {
    const rootA = toHierarchy(treeA)
    const rootB = toHierarchy(treeB)
    const hA = hierarchy(rootA).sum(() => 1)
    const hB = hierarchy(rootB).sum(() => 1)
    const layout = treemap<TreeNode>().size([width, halfH]).padding(2).tile(treemapSquarify)
    return {
      nodesA: layout(hA).descendants(),
      nodesB: layout(hB).descendants(),
      hashMapB: buildHashMap(treeB),
      hashMapA: buildHashMap(treeA),
    }
  }, [treeA, treeB, width, halfH])

  const diffColor = (node: HierarchyRectangularNode<TreeNode>, otherMap: Map<string, string>) => {
    const k = `${node.data.level}:${node.data.key}`
    const otherHash = otherMap.get(k)
    if (node.data.hash === 'virtual') return 'rgba(85,85,85,0.3)'
    if (!otherHash) return 'rgba(136,136,136,0.5)'
    return otherHash === node.data.hash ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.7)'
  }

  const renderNodes = (nodes: HierarchyRectangularNode<TreeNode>[], otherMap: Map<string, string>, yOffset: number) =>
    nodes
      .filter((n) => !n.children || n.children.length === 0)
      .map((n, i) => {
        const w = n.x1 - n.x0
        const h = n.y1 - n.y0
        if (w < 2 || h < 2) return null
        return (
          <g key={i} transform={`translate(${n.x0},${n.y0 + yOffset})`}>
            <rect width={w} height={h} fill={diffColor(n, otherMap)} stroke="#1e1e2e" strokeWidth={0.5} rx={1} />
            {w > 24 && h > 12 && (
              <text x={3} y={h / 2 + 3} fontSize={9} fill="#e4e4e7" fontFamily="monospace">
                {n.data.key}
              </text>
            )}
          </g>
        )
      })

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-zinc-300">Spike 3: Treemap (d3 treemap)</h3>
      <p className="text-xs text-zinc-500 mb-2">
        Area = key coverage. Leaves only. <span className="text-green-400">Green</span> = match,{' '}
        <span className="text-red-400">Red</span> = divergent.
      </p>
      <svg width={width} height={height} className="bg-zinc-900 rounded">
        <text x={4} y={12} fontSize={10} fill="#a1a1aa">Robot A</text>
        {renderNodes(nodesA, hashMapB, 16)}
        <text x={4} y={halfH + 22} fontSize={10} fill="#a1a1aa">Robot B</text>
        {renderNodes(nodesB, hashMapA, halfH + 28)}
      </svg>
    </div>
  )
}
