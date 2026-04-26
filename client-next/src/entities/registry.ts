import { ComponentType } from 'react'
import { AnyEntity } from '../types/protocol'
import type { RenderTier } from '../stores/settingsStore'

export interface EntityRendererProps {
  entity: AnyEntity
  selected?: boolean
  ghost?: boolean
  tier?: RenderTier
  onClick?: () => void
  onDoubleClick?: () => void
  onPointerDown?: (e: React.PointerEvent | any) => void
  overrideColor?: string
}

export type EntityRenderer = ComponentType<EntityRendererProps>

class EntityRegistry {
  private renderers = new Map<string, EntityRenderer>()

  register(entityType: string, renderer: EntityRenderer): void {
    this.renderers.set(entityType, renderer)
  }

  get(entityType: string): EntityRenderer | undefined {
    return this.renderers.get(entityType)
  }

  has(entityType: string): boolean {
    return this.renderers.has(entityType)
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys())
  }
}

export const entityRegistry = new EntityRegistry()
