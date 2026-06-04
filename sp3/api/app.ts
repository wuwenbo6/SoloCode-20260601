/**
 * SRv6 Simulator API Server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import authRoutes from './routes/auth.js'
import type { SimulateRequest, SimulateResponse, HealthResponse, CompressionResult } from '../shared/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)

app.get(
  '/api/health',
  async (req: Request, res: Response<HealthResponse>): Promise<void> => {
    let pythonAvailable = false
    try {
      const pythonProcess = spawn('python3', ['--version'])
      pythonAvailable = await new Promise<boolean>((resolve) => {
        pythonProcess.on('exit', (code) => resolve(code === 0))
        pythonProcess.on('error', () => resolve(false))
      })
    } catch {
      pythonAvailable = false
    }
    
    res.status(200).json({
      status: 'ok',
      pythonAvailable,
      timestamp: new Date().toISOString(),
    })
  },
)

app.post(
  '/api/simulate',
  async (req: Request<{}, {}, SimulateRequest>, res: Response<SimulateResponse>): Promise<void> => {
    try {
      const { sidCount, customSids, prefix, compressionMethod } = req.body
      
      const inputData: SimulateRequest = {
        sidCount: sidCount ?? 5,
        customSids: customSids?.filter(s => s.trim()),
        prefix: prefix?.trim() || undefined,
        compressionMethod: compressionMethod ?? 'prefix',
      }
      
      const scriptPath = path.join(__dirname, '..', 'python', 'srv6_simulator.py')
      
      const pythonProcess = spawn('python3', [scriptPath])
      
      let stdout = ''
      let stderr = ''
      
      pythonProcess.stdin.write(JSON.stringify(inputData))
      pythonProcess.stdin.end()
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      const exitCode = await new Promise<number>((resolve) => {
        pythonProcess.on('exit', resolve)
      })
      
      if (exitCode !== 0) {
        res.status(500).json({
          success: false,
          error: `Python script failed: ${stderr || 'Unknown error'}`,
        })
        return
      }
      
      let result: CompressionResult
      try {
        const parsed = JSON.parse(stdout)
        if (!parsed.success || !parsed.data) {
          throw new Error('Invalid response from Python script')
        }
        result = parsed.data
      } catch (parseError) {
        res.status(500).json({
          success: false,
          error: `Failed to parse Python output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        })
        return
      }
      
      res.status(200).json({
        success: true,
        data: result,
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
