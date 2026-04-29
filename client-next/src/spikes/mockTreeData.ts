/** Mock Prolly tree data matching PN-003's proposed C++ export shape */

export interface TreeNode {
  level: number
  key: string
  hash: string
  boundary: boolean
  children?: TreeNode[]
}

export interface FlatTreeData {
  max_level: number
  tree_nodes: TreeNode[]
}

// --- Small tree: 8 keys, 3 levels ---

export const smallTreeA: FlatTreeData = {
  max_level: 2,
  tree_nodes: [
    { level: 0, key: 'k0', hash: 'aa11', boundary: true },
    { level: 0, key: 'k1', hash: 'aa22', boundary: false },
    { level: 0, key: 'k2', hash: 'bb33', boundary: true },
    { level: 0, key: 'k3', hash: 'bb44', boundary: false },
    { level: 0, key: 'k4', hash: 'cc55', boundary: true },
    { level: 0, key: 'k5', hash: 'cc66', boundary: false },
    { level: 0, key: 'k6', hash: 'dd77', boundary: true },
    { level: 0, key: 'k7', hash: 'dd88', boundary: false },
    { level: 1, key: 'k0', hash: '1111', boundary: true },
    { level: 1, key: 'k4', hash: '2222', boundary: true },
    { level: 2, key: 'k0', hash: 'root_a', boundary: true },
  ],
}

// Robot B: k3 and k4 differ → propagates up through level 1 and root
export const smallTreeB: FlatTreeData = {
  max_level: 2,
  tree_nodes: [
    { level: 0, key: 'k0', hash: 'aa11', boundary: true },
    { level: 0, key: 'k1', hash: 'aa22', boundary: false },
    { level: 0, key: 'k2', hash: 'bb33', boundary: true },
    { level: 0, key: 'k3', hash: 'XX44', boundary: false },   // CHANGED
    { level: 0, key: 'k4', hash: 'YY55', boundary: true },    // CHANGED
    { level: 0, key: 'k5', hash: 'cc66', boundary: false },
    { level: 0, key: 'k6', hash: 'dd77', boundary: true },
    { level: 0, key: 'k7', hash: 'dd88', boundary: false },
    { level: 1, key: 'k0', hash: 'FF11', boundary: true },    // CHANGED (child changed)
    { level: 1, key: 'k4', hash: 'GG22', boundary: true },    // CHANGED (child changed)
    { level: 2, key: 'k0', hash: 'root_b', boundary: true },  // CHANGED
  ],
}

// --- Wide tree: 32 keys, 3 levels, branching ~8 ---

function generateWideTree(seed: string, mutations: Set<string>): FlatTreeData {
  const nodes: TreeNode[] = []
  // 32 leaf nodes
  for (let i = 0; i < 32; i++) {
    const key = `k${String(i).padStart(2, '0')}`
    const base = `${seed}_L0_${key}`
    nodes.push({
      level: 0,
      key,
      hash: mutations.has(key) ? `MUT_${base}` : base,
      boundary: i % 4 === 0,
    })
  }
  // 8 level-1 nodes (each covers 4 leaves)
  for (let i = 0; i < 8; i++) {
    const key = `k${String(i * 4).padStart(2, '0')}`
    const childKeys = Array.from({ length: 4 }, (_, j) => `k${String(i * 4 + j).padStart(2, '0')}`)
    const anyMutated = childKeys.some((k) => mutations.has(k))
    nodes.push({
      level: 1,
      key,
      hash: anyMutated ? `MUT_${seed}_L1_${key}` : `${seed}_L1_${key}`,
      boundary: true,
    })
  }
  // 2 level-2 nodes (each covers 4 level-1 nodes)
  for (let i = 0; i < 2; i++) {
    const key = `k${String(i * 16).padStart(2, '0')}`
    const childRange = Array.from({ length: 16 }, (_, j) => `k${String(i * 16 + j).padStart(2, '0')}`)
    const anyMutated = childRange.some((k) => mutations.has(k))
    nodes.push({
      level: 2,
      key,
      hash: anyMutated ? `MUT_${seed}_L2_${key}` : `${seed}_L2_${key}`,
      boundary: true,
    })
  }
  // root
  nodes.push({
    level: 3,
    key: 'k00',
    hash: mutations.size > 0 ? `MUT_${seed}_root` : `${seed}_root`,
    boundary: true,
  })
  return { max_level: 3, tree_nodes: nodes }
}

export const wideTreeA = generateWideTree('A', new Set())
export const wideTreeB = generateWideTree('B', new Set(['k05', 'k06', 'k20', 'k21']))

/** Convert flat node list to d3-hierarchy-compatible nested structure */
export function toHierarchy(flat: FlatTreeData): TreeNode {
  const byLevel = new Map<number, TreeNode[]>()
  for (const n of flat.tree_nodes) {
    const list = byLevel.get(n.level) ?? []
    list.push({ ...n, children: [] })
    byLevel.set(n.level, list)
  }

  // Link children: each node at level L owns leaves at level L-1
  // between its key and the next node's key at the same level
  for (let lvl = flat.max_level; lvl > 0; lvl--) {
    const parents = byLevel.get(lvl) ?? []
    const children = byLevel.get(lvl - 1) ?? []
    for (let i = 0; i < parents.length; i++) {
      const start = parents[i].key
      const end = i + 1 < parents.length ? parents[i + 1].key : '\uffff'
      parents[i].children = children.filter((c) => c.key >= start && c.key < end)
    }
  }

  const roots = byLevel.get(flat.max_level) ?? []
  if (roots.length === 1) return roots[0]
  return { level: flat.max_level + 1, key: 'root', hash: 'virtual', boundary: true, children: roots }
}

/** Build a hash lookup from tree B for diff comparison */
export function buildHashMap(flat: FlatTreeData): Map<string, string> {
  const m = new Map<string, string>()
  for (const n of flat.tree_nodes) {
    m.set(`${n.level}:${n.key}`, n.hash)
  }
  return m
}
