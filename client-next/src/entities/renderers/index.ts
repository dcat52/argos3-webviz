import { entityRegistry } from '../registry'
import { FootBot } from './FootBot'
import { KheperaIV } from './KheperaIV'
import { BoxRenderer } from './BoxRenderer'
import { CylinderRenderer } from './CylinderRenderer'
import { LightRenderer } from './LightRenderer'
import { FloorRenderer } from './FloorRenderer'

entityRegistry.register('foot-bot', FootBot)
entityRegistry.register('kheperaiv', KheperaIV)
entityRegistry.register('box', BoxRenderer)
entityRegistry.register('cylinder', CylinderRenderer)
entityRegistry.register('light', LightRenderer)
entityRegistry.register('floor', FloorRenderer)
