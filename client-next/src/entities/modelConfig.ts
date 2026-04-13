/**
 * Model configuration for entity types.
 * Maps ARGoS entity type strings to GLB model paths and transforms.
 *
 * Robots without OBJ models (foot-bot, kheperaiv, e-puck, eye-bot)
 * are rendered procedurally — they are NOT listed here.
 */

export interface ModelPart {
  url: string
  scale?: [number, number, number]
  rotation?: [number, number, number]
  position?: [number, number, number]
}

export interface ModelConfig {
  parts: ModelPart[]
  /** Default material overrides */
  metalness?: number
  roughness?: number
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  pipuck: {
    parts: [
      { url: '/models/pipuck.glb', scale: [1, 1, 1] },
      // wheels are separate meshes in Qt — included in main model for now
    ],
  },
  drone: {
    parts: [
      { url: '/models/drone.glb', scale: [1, 1, 1] },
      { url: '/models/propeller.glb', scale: [1, 1, 1] },
    ],
  },
  spiri: {
    parts: [
      { url: '/models/spiri.glb', scale: [1, 1, 1] },
    ],
  },
  builderbot: {
    parts: [
      { url: '/models/builderbot.glb', scale: [1, 1, 1] },
      { url: '/models/builderbot-manipulator.glb', scale: [1, 1, 1] },
    ],
  },
  block: {
    parts: [
      { url: '/models/block.glb', scale: [1, 1, 1] },
    ],
  },
}
