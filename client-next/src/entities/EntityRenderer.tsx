import './renderers' // side-effect: register built-in renderers
import { AnyEntity } from '../types/protocol'
import { entityRegistry } from './registry'
import { DefaultEntity } from './DefaultEntity'

interface Props {
  entity: AnyEntity
  selected?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  overrideColor?: string
}

export function EntityRenderer({ entity, selected, onClick, onDoubleClick, overrideColor }: Props) {
  const Renderer = entityRegistry.get(entity.type) ?? DefaultEntity
  return <Renderer entity={entity} selected={selected} onClick={onClick} onDoubleClick={onDoubleClick} overrideColor={overrideColor} />
}
