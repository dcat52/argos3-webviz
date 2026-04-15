import type { VizConfig } from '@/stores/vizConfigStore'

export interface VizPreset {
  id: string
  name: string
  description: string
  /** Fields this preset expects in user_data */
  requiredFields: string[]
  config: VizConfig
}

export const vizPresets: VizPreset[] = [
  {
    id: 'sync_progress',
    name: 'Sync Progress',
    description: 'Canopy key synchronization — color by sync ratio, link neighbors',
    requiredFields: ['key_count', 'total_keys', 'neighbors'],
    config: {
      colorBy: { enabled: true, field: 'key_count', scale: 'linear', colorA: '#ff0000', colorB: '#0000ff' },
      links: { enabled: true, field: 'neighbors', color: '#44aaff', opacity: 0.4 },
      labels: [{ enabled: true, field: 'key_count' }],
      trails: { enabled: false, length: 50, opacity: 0.6 },
      heatmap: { enabled: false, resolution: 64, decay: 0.98, colorA: '#000000', colorB: '#ff4400' },
    },
  },
  {
    id: 'beacon_diffusion',
    name: 'Beacon Diffusion',
    description: 'Canopy beacon spread — categorical color, comm links, trails',
    requiredFields: ['has_beacon', 'neighbors'],
    config: {
      colorBy: { enabled: true, field: 'has_beacon', scale: 'categorical', colorA: '#0066ff', colorB: '#ff3333' },
      links: { enabled: true, field: 'neighbors', color: '#ffffff', opacity: 0.3 },
      labels: [],
      trails: { enabled: true, length: 100, opacity: 0.4 },
      heatmap: { enabled: false, resolution: 64, decay: 0.98, colorA: '#000000', colorB: '#ff4400' },
    },
  },
  {
    id: 'foraging',
    name: 'Foraging',
    description: 'Food collection — color by carrying state, density heatmap',
    requiredFields: ['has_food'],
    config: {
      colorBy: { enabled: true, field: 'has_food', scale: 'categorical', colorA: '#888888', colorB: '#44bb44' },
      links: null,
      labels: [],
      trails: { enabled: true, length: 80, opacity: 0.3 },
      heatmap: { enabled: true, resolution: 64, decay: 0.98, colorA: '#000000', colorB: '#ff4400' },
    },
  },
  {
    id: 'trajectory',
    name: 'Trajectory',
    description: 'Movement paths — trails with robot ID labels',
    requiredFields: [],
    config: {
      colorBy: null,
      links: null,
      labels: [],
      trails: { enabled: true, length: 200, opacity: 0.6 },
      heatmap: { enabled: false, resolution: 64, decay: 0.98, colorA: '#000000', colorB: '#ff4400' },
    },
  },
  {
    id: 'communication_graph',
    name: 'Communication Graph',
    description: 'Network topology — link neighbors, no trails',
    requiredFields: ['neighbors'],
    config: {
      colorBy: null,
      links: { enabled: true, field: 'neighbors', color: '#44aaff', opacity: 0.6 },
      labels: [],
      trails: { enabled: false, length: 50, opacity: 0.6 },
      heatmap: { enabled: false, resolution: 64, decay: 0.98, colorA: '#000000', colorB: '#ff4400' },
    },
  },
  {
    id: 'density',
    name: 'Density Map',
    description: 'Spatial density heatmap with trails',
    requiredFields: [],
    config: {
      colorBy: null,
      links: null,
      labels: [],
      trails: { enabled: true, length: 50, opacity: 0.3 },
      heatmap: { enabled: true, resolution: 64, decay: 0.95, colorA: '#000000', colorB: '#ff4400' },
    },
  },
  {
    id: 'none',
    name: 'None',
    description: 'Clear all visualizations',
    requiredFields: [],
    config: {
      colorBy: null,
      links: null,
      labels: [],
      trails: { enabled: false, length: 50, opacity: 0.6 },
      heatmap: { enabled: false, resolution: 64, decay: 0.98, colorA: '#000000', colorB: '#ff4400' },
    },
  },
]

/** Find presets whose required fields are all present */
export function getAvailablePresets(discoveredFields: string[]): VizPreset[] {
  return vizPresets.filter(p =>
    p.requiredFields.every(f => discoveredFields.includes(f))
  )
}
