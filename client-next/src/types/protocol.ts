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

export type ServerMessage = BroadcastMessage | EventMessage | LogMessage

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
  | CustomCommand
