export enum ExperimentState {
  EXPERIMENT_INITIALIZED = 'EXPERIMENT_INITIALIZED',
  EXPERIMENT_PLAYING = 'EXPERIMENT_PLAYING',
  EXPERIMENT_PAUSED = 'EXPERIMENT_PAUSED',
  EXPERIMENT_FAST_FORWARDING = 'EXPERIMENT_FAST_FORWARDING',
  EXPERIMENT_DONE = 'EXPERIMENT_DONE',
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface ArenaInfo {
  size: Vec3
  center: Vec3
}

// --- Entities ---

export interface BaseEntity {
  type: string
  id: string
  position: Vec3
  orientation: Quaternion
  user_data?: unknown
}

export interface RobotEntity extends BaseEntity {
  leds: string[]
  rays: string[]
  points: string[]
}

export interface FootBotEntity extends RobotEntity {
  type: 'foot-bot'
}

export interface KheperaIVEntity extends RobotEntity {
  type: 'kheperaiv'
}

export interface LeoEntity extends BaseEntity {
  type: 'Leo'
  rays: string[]
  points: string[]
}

export interface LedInfo {
  color: string
  position: Vec3
}

export interface BoxEntity extends BaseEntity {
  type: 'box'
  is_movable: boolean
  scale: Vec3
  leds?: LedInfo[]
}

export interface CylinderEntity extends BaseEntity {
  type: 'cylinder'
  is_movable: boolean
  height: number
  radius: number
  leds?: LedInfo[]
}

export interface LightEntity extends BaseEntity {
  type: 'light'
  color: string
}

export interface FloorEntity {
  type: 'floor'
  id: string
  floor_image?: string
}

export type AnyEntity =
  | FootBotEntity
  | KheperaIVEntity
  | LeoEntity
  | BoxEntity
  | CylinderEntity
  | LightEntity
  | FloorEntity

// --- Server Messages ---

export interface BroadcastMessage {
  type: 'broadcast'
  state: ExperimentState
  steps: number
  timestamp: number
  arena: ArenaInfo
  entities: AnyEntity[]
  user_data?: unknown
}

export interface SchemaMessage {
  type: 'schema'
  state?: ExperimentState
  steps?: number
  timestamp?: number
  arena: ArenaInfo
  entities: AnyEntity[]
  user_data?: unknown
}

export interface DeltaMessage {
  type: 'delta'
  state?: ExperimentState
  steps?: number
  timestamp?: number
  arena?: ArenaInfo
  entities: Record<string, Partial<AnyEntity>>
  removed?: string[]
  user_data?: unknown
}

export interface EventMessage {
  type: 'event'
  event: string
  state: ExperimentState
}

export interface LogEntry {
  log_type: 'LOG' | 'LOGERR'
  log_message: string
  step: number
}

export interface LogMessage {
  type: 'log'
  timestamp: number
  messages: LogEntry[]
}

export type ServerMessage = BroadcastMessage | SchemaMessage | DeltaMessage | EventMessage | LogMessage | MetadataMessage

export interface MetadataMessage {
  type: 'metadata'
  controllers: string[]
  entity_types: string[]
}

// --- Client Commands ---

export interface PlayCommand {
  command: 'play'
}

export interface PauseCommand {
  command: 'pause'
}

export interface StepCommand {
  command: 'step'
}

export interface ResetCommand {
  command: 'reset'
}

export interface TerminateCommand {
  command: 'terminate'
}

export interface FastForwardCommand {
  command: 'fastforward'
  steps?: number
}

export interface MoveEntityCommand {
  command: 'moveEntity'
  entity_id: string
  position: Vec3
  orientation: Quaternion
}

export interface AddEntityCommand {
  command: 'addEntity'
  type: string
  id_prefix?: string
  position: Vec3
  orientation?: Quaternion
  controller?: string
  size?: Vec3
  movable?: boolean
  mass?: number
  radius?: number
  height?: number
  color?: string
}

export interface RemoveEntityCommand {
  command: 'removeEntity'
  entity_id: string
}

export interface GetMetadataCommand {
  command: 'getMetadata'
}

export interface DistributeCommand {
  command: 'distribute'
  type: string
  id_prefix?: string
  quantity: number
  max_trials?: number
  position_method: 'uniform' | 'gaussian' | 'constant' | 'grid'
  position_params: Record<string, unknown>
  orientation_method?: 'uniform' | 'gaussian' | 'constant'
  orientation_params?: Record<string, unknown>
  controller?: string
  size?: Vec3
  movable?: boolean
  mass?: number
  radius?: number
  height?: number
}

export interface SpeedCommand {
  command: 'speed'
  factor: number
}

export interface CustomCommand {
  [key: string]: unknown
}

export type ClientCommand =
  | PlayCommand
  | PauseCommand
  | StepCommand
  | ResetCommand
  | TerminateCommand
  | FastForwardCommand
  | MoveEntityCommand
  | AddEntityCommand
  | RemoveEntityCommand
  | GetMetadataCommand
  | DistributeCommand
  | SpeedCommand
  | CustomCommand

// --- Draw Commands (from user_data._draw) ---

export type DrawCommand =
  | { shape: 'circle'; pos: [number, number, number]; radius: number; color: [number, number, number, number]; fill: boolean }
  | { shape: 'cylinder'; pos: [number, number, number]; radius: number; height: number; color: [number, number, number, number] }
  | { shape: 'ray'; start: [number, number, number]; end: [number, number, number]; color: [number, number, number, number]; width: number }
  | { shape: 'text'; pos: [number, number, number]; text: string; color: [number, number, number, number] }

export interface FloorColorGrid {
  resolution: number
  origin: [number, number]
  size: [number, number]
  colors: string // base64-encoded RGB bytes
}

// --- UI Controls (from user_data._ui) ---

export type UIControl =
  | { type: 'button'; id: string; label: string }
  | { type: 'slider'; id: string; label: string; min: number; max: number; value: number }
  | { type: 'toggle'; id: string; label: string; value: boolean }
  | { type: 'dropdown'; id: string; label: string; options: string[]; value: string }
