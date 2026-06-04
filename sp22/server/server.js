import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initIPFS, stopIPFS } from './ipfs-node.js'
import snippetsRouter from './routes/snippets.js'
import commentsRouter from './routes/comments.js'
import searchRouter from './routes/search.js'
import embedRouter from './routes/embed.js'
import { startExpirationCleanup, stopExpirationCleanup, getCleanupStatus } from './unpin.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const REQUEST_TIMEOUT = 5 * 60 * 1000

app.use(cors())
app.use(express.json({ limit: '50mb' }))

app.use('/api/snippets', snippetsRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/search', searchRouter)
app.use('/api/embed', embedRouter)

app.get('/api/health', (req, res) => {
  const cleanupStatus = getCleanupStatus()
  res.json({ 
    status: 'ok', 
    message: 'IPFS Code Snippet Server is running',
    expirationCleanup: cleanupStatus
  })
})

async function startServer() {
  try {
    await initIPFS()
    
    startExpirationCleanup()
    
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
      console.log(`Health check: http://localhost:${PORT}/api/health`)
    })

    server.timeout = REQUEST_TIMEOUT
    server.keepAliveTimeout = 65000
    server.headersTimeout = 66000

    server.on('connection', (socket) => {
      socket.setTimeout(REQUEST_TIMEOUT)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...')
  stopExpirationCleanup()
  await stopIPFS()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  stopExpirationCleanup()
  await stopIPFS()
  process.exit(0)
})

startServer()
