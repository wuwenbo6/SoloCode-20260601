import { createServer } from 'http'
import app from './app.js'
import { WebSocketServer, WebSocket } from 'ws'
import { GameSession } from './session-manager.js'

const PORT = process.env.PORT || 3001

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected')
  const session = new GameSession(ws)

  ws.on('close', () => {
    console.log('Client disconnected')
    session.destroy()
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err)
    session.destroy()
  })
})

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})

export default app
