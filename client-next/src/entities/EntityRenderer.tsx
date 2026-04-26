import './renderers' // side-effect: register built-in renderers
import { AnyEntity } from '../types/protocol'
import { entityRegistry, type EntityRendererProps } from './registry'
import { DefaultEntity } from './DefaultEntity'

export function EntityRenderer(props: EntityRendererProps) {
  const Renderer = entityRegistry.get(props.entity.type) ?? DefaultEntity
  return <Renderer {...props} />
}
