import http from 'http'
import { WebSocketServer } from 'ws'
import app from './app.js'
import { handleConnection } from './signaling.js'
import { roomManager } from './room-manager.js'

const PORT = process.env.PORT || 3001

const server = http.createServer(app)

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  handleConnection(ws)
})

roomManager.init().then(() => {
  server.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`)
    console.log(`WebSocket server ready at ws://localhost:${PORT}/ws`)
  })
}).catch((err) => {
  console.error('Failed to initialize mediasoup worker:', err)
  process.exit(1)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received')
  wss.close()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT signal received')
  wss.close()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export default server
