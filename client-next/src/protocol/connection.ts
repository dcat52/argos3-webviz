import type { ServerMessage, ClientCommand } from '../types/protocol'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface ConnectionConfig {
  url: string
  channels?: ('broadcasts' | 'events' | 'logs')[]
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectInterval?: number
}

type MessageHandler = (message: ServerMessage) => void
type StatusHandler = (status: ConnectionStatus) => void

export class WebvizConnection {
  private ws: WebSocket | null = null
  private config: ConnectionConfig
  private reconnectDelay: number
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  onMessage: MessageHandler | null = null
  onStatusChange: StatusHandler | null = null

  constructor(config: ConnectionConfig) {
    this.config = config
    this.reconnectDelay = config.reconnectInterval ?? 1000
  }

  get status(): ConnectionStatus {
    if (!this.ws) return 'disconnected'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      default:
        return 'disconnected'
    }
  }

  connect(): void {
    this.intentionalClose = false
    this.reconnectDelay = this.config.reconnectInterval ?? 1000

    const url = this.buildUrl()
    this.setStatus('connecting')
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('[WebvizConnection] connected to', url)
      this.reconnectDelay = this.config.reconnectInterval ?? 1000
      this.setStatus('connected')
    }

    this.ws.onmessage = (ev: MessageEvent) => {
      if (!this.onMessage) return
      try {
        const data: unknown = JSON.parse(String(ev.data))
        if (isServerMessage(data)) this.onMessage(data)
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = (ev) => {
      console.log('[WebvizConnection] closed:', ev.code, ev.reason)
      this.ws = null
      this.setStatus('disconnected')
      if (!this.intentionalClose && this.config.reconnect !== false) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (ev) => {
      console.error('[WebvizConnection] error:', ev)
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
  }

  send(command: ClientCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command))
    }
  }

  private buildUrl(): string {
    return this.config.url
  }

  private scheduleReconnect(): void {
    const max = this.config.maxReconnectInterval ?? 30000
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, max)
  }

  private setStatus(status: ConnectionStatus): void {
    this.onStatusChange?.(status)
  }
}

function isServerMessage(data: unknown): data is ServerMessage {
  if (typeof data !== 'object' || data === null) return false
  const t = (data as Record<string, unknown>)['type']
  return t === 'broadcast' || t === 'schema' || t === 'delta' || t === 'event' || t === 'log'
}
