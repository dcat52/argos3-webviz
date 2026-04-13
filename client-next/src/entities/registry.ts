import { ComponentType } from 'react'
import { AnyEntity } from '../types/protocol'

export interface EntityRendererProps {
  entity: AnyEntity
  selected?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
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
