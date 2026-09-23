export type WsEventHandler = (data: any) => void

class WebSocketClient {
  private socket: WebSocket | null = null
  private listeners: Map<string, Set<WsEventHandler>> = new Map()
  private isConnecting = false
  public isConnected = false

  constructor() {
    this.connect()
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.isConnecting = true
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // If running with Vite proxy, /ws maps to target backend port 3080
    const wsUrl = `${protocol}//${window.location.host}/ws`

    try {
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        this.isConnected = true
        this.isConnecting = false
        console.log('⚡ [CompanyOS:WS] Backend WebSocket bağlantısı kuruldu!')
        this.emit('connection/change', { connected: true })
      }

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type) {
            this.emit(payload.type, payload.data || payload)
          }
          this.emit('*', payload)
        } catch (e) {
          console.warn('[CompanyOS:WS] JSON parse hatası:', e)
        }
      }

      this.socket.onclose = () => {
        this.isConnected = false
        this.isConnecting = false
        console.log('⚠️ [CompanyOS:WS] WebSocket bağlantısı koptu, 3 sn sonra yeniden denenecek...')
        this.emit('connection/change', { connected: false })
        setTimeout(() => this.connect(), 3000)
      }

      this.socket.onerror = (err) => {
        console.error('❌ [CompanyOS:WS] Hata:', err)
        this.isConnected = false
      }
    } catch (err) {
      this.isConnecting = false
      setTimeout(() => this.connect(), 3000)
    }
  }

  public on(event: string, handler: WsEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  public off(event: string, handler: WsEventHandler): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(handler)
    }
  }

  public emit(event: string, data: any): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach(h => {
        try { h(data) } catch (e) { console.error(e) }
      })
    }
  }

  public send(type: string, data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, ...data }))
    } else {
      console.warn('[CompanyOS:WS] Mesaj gönderilemedi, soket hazır değil:', type)
    }
  }

  public abort(): void {
    this.send('abort', {})
  }

  public sendDirective(params: {
    sessionId: string
    prompt: string
    preset?: string
    workspace?: string
  }): void {
    this.send('chat', {
      sessionId: params.sessionId,
      prompt: params.prompt,
      presetId: params.preset,
      workspace: params.workspace,
      userId: 'user_admin'
    })
  }
}

export const wsClient = new WebSocketClient()
