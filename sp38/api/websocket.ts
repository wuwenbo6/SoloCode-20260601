import { WebSocket, WebSocketServer } from 'ws'
import http from 'http'
import type { AddressInfo } from 'net'

const clients = new Set<WebSocket>()

let wss: WebSocketServer

export function initWebSocket(server: http.Server) {
  wss = new WebSocketServer({ server })

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws)

    ws.on('close', () => {
      clients.delete(ws)
    })

    ws.on('error', () => {
      clients.delete(ws)
    })
  })
}

export function broadcastEvent(event: Record<string, unknown>) {
  const data = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  }
}
