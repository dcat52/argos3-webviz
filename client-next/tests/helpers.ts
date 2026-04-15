import { ExperimentState, type BroadcastMessage, type SchemaMessage, type DeltaMessage, type AnyEntity } from '@/types/protocol'

export function makeEntity(id: string, x = 0, y = 0, leds = ['0x000000']): AnyEntity {
  return {
    type: 'kheperaiv', id,
    position: { x, y, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    leds, rays: [], points: [],
  } as AnyEntity
}

export function makeBroadcast(entities: AnyEntity[], steps = 1): BroadcastMessage {
  return {
    type: 'broadcast',
    state: ExperimentState.EXPERIMENT_PLAYING,
    steps, timestamp: Date.now(),
    arena: { size: { x: 10, y: 10, z: 1 }, center: { x: 0, y: 0, z: 0.5 } },
    entities,
  }
}

export function makeSchema(entities: AnyEntity[]): SchemaMessage {
  return {
    type: 'schema',
    arena: { size: { x: 10, y: 10, z: 1 }, center: { x: 0, y: 0, z: 0.5 } },
    entities,
  }
}

export function makeDelta(entities: Record<string, Partial<AnyEntity>>, steps = 2): DeltaMessage {
  return { type: 'delta', steps, entities }
}
