import { registerFeature } from '@/stores/featureStore'

registerFeature({ id: 'distribute', label: 'Distribute Spawn', description: 'Spawn multiple entities with distribution patterns', experimental: true })
registerFeature({ id: 'color-by', label: 'Color By Field', description: 'Color entities by a data field', experimental: true })
registerFeature({ id: 'heatmap', label: 'Heatmap Overlay', description: 'Density heatmap of entity positions', experimental: true })
registerFeature({ id: 'trails', label: 'Entity Trails', description: 'Show movement trails behind entities', experimental: true })
registerFeature({ id: 'viz-presets', label: 'Viz Presets', description: 'Pre-configured visualization presets', experimental: true })
registerFeature({ id: 'batch-spawn', label: 'Quick Batch Spawn', description: 'Batch spawn from sidebar', experimental: true })