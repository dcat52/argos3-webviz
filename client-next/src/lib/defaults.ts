/** Centralized defaults for all configurable values. */

export const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 5, label: '5×' },
  { value: 10, label: '10×' },
  { value: 50, label: '50×' },
  { value: 1000, label: '∞' },
]

export const SPEED_INFINITY_THRESHOLD = 1000
export const SPEED_TRANSITION_DELAY_MS = 50

export const COLORS = {
  selection: '#44aaff',
  selectionOpacity: 0.8,
  rayHit: '#44ff44',
  rayMiss: '#ff4444',
  trail: '#44aaff',
  boxMovable: '#4488cc',
  boxNonMovable: '#555566',
  boxSelected: '#8899aa',
  cylinderMovable: '#44aa88',
  cylinderNonMovable: '#555566',
  cylinderSelected: '#8899aa',
  footBotBody: '#2a2a3a',
  footBotSelected: '#5577aa',
  kheperaBody: '#2a3a4a',
  kheperaSelected: '#5577aa',
  kheperaCap: '#334455',
  leoBody: '#5a6e5a',
  leoSelected: '#6e8e6e',
  floorFallback: '#333333',
}

export const CAMERA = {
  fov: 50,
  defaultPosition: [0, -12, 10] as [number, number, number],
  minDistance: 0.5,
  maxDistanceMultiplier: 3,
  smoothTime: 0.25,
  maxPolarAngle: Math.PI / 2.05,
  followOffset: [1, -1, 1.5] as [number, number, number],
}

export const LIGHTING = {
  directionalPosition: [-5, 8, 4] as [number, number, number],
  directionalIntensity: 0.3,
  directionalColor: '#aaccff',
  hemisphereSkyColor: '#ddeeff',
  hemisphereGroundColor: '#f0eeee',
  hemisphereIntensity: 0.4,
  shadowCameraFar: 50,
}

export const LIMITS = {
  maxLogEntries: 1000,
  maxEventLogEntries: 200,
}

export const RECORDING = {
  captureFps: 30,
  videoBitrate: 5_000_000,
}

export const CONNECTION = {
  defaultPort: 3000,
  reconnectIntervalMs: 1000,
}

export const VIZ_DEFAULTS = {
  trailLength: 50,
  trailOpacity: 0.6,
  heatmapResolution: 64,
  heatmapDecay: 0.98,
  heatmapColorA: '#000000',
  heatmapColorB: '#ff4400',
  colorByColorA: '#0000ff',
  colorByColorB: '#ff0000',
  linksColor: '#44aaff',
  linksOpacity: 0.6,
}
