import { useMemo } from 'react'
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy'
import { toHierarchy, buildHashMap, type FlatTreeData, type TreeNode } from './mockTreeData'

interface Props {
  treeA: FlatTreeData
  treeB: FlatTreeData
  width?: number
  height?: number
}

export function NodeLinkSpike({ treeA, treeB, width = 600, height = 400 }: Props) {
  const halfH = height / 2 - 20

  const { nodesA, nodesB, hashMapB, hashMapA } = useMemo(() => {
    const rootA = toHierarchy(treeA)
    const rootB = toHierarchy(treeB)
    const hA = hierarchy(rootA)
    const hB = hierarchy(rootB)
    const layout = tree<TreeNode>().size([width - 40, halfH - 40])
    return {
      nodesA: layout(hA),
      nodesB: layout(hB),
      hashMapB: buildHashMap(treeB),
      hashMapA: buildHashMap(treeA),
    }
  }, [treeA, treeB, width, halfH])

  const diffColor = (node: HierarchyPointNode<TreeNode>, otherMap: Map<string, string>) => {
    const k = `${node.data.level}:${node.data.key}`
    const otherHash = otherMap.get(k)
    if (node.data.hash === 'virtual') return '#555'
    if (!otherHash) return '#888'
    return otherHash === node.data.hash ? '#4ade80' : '#f87171'
  }

  const renderTree = (root: HierarchyPointNode<TreeNode>, otherMap: Map<string, string>, yOffset: number) => {
    const nodes = root.descendants()
    const links = root.links()
    return (
      <g transform={`translate(20,${yOffset})`}>
        {links.map((l, i) => (
          <line
            key={i}
            x1={l.source.x} y1={l.source.y}
            x2={l.target.x} y2={l.target.y}
            stroke="#555" strokeWidth={1}
          />
        ))}
        {nodes.map((n, i) => (
          <g key={i} transform={`translate(${n.x},${n.y})`}>
            <circle r={8} fill={diffColor(n, otherMap)} stroke="#1e1e2e" strokeWidth={1} />
            <text y={-12} textAnchor="middle" fontSize={9} fill="#a1a1aa" fontFamily="monospace">
              {n.data.key}
            </text>
            <text y={3} textAnchor="middle" fontSize={7} fill="#1e1e2e" fontFamily="monospace">
              {n.data.hash.slice(0, 4)}
            </text>
          </g>
        ))}
      </g>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-zinc-300">Spike 2: Node-Link Tree (d3 tree layout)</h3>
      <p className="text-xs text-zinc-500 mb-2">
        Classic top-down tree. <span className="text-green-400">Green</span> = match,{' '}
        <span className="text-red-400">Red</span> = divergent.
      </p>
      <svg width={width} height={height} className="bg-zinc-900 rounded">
        <text x={4} y={12} fontSize={10} fill="#a1a1aa">Robot A</text>
        {renderTree(nodesA, hashMapB, 20)}
        <text x={4} y={halfH + 22} fontSize={10} fill="#a1a1aa">Robot B</text>
        {renderTree(nodesB, hashMapA, halfH + 30)}
      </svg>
    </div>
  )
}
