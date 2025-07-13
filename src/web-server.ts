import express from 'express'
import multer from 'multer'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import * as path from 'path'
import * as fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import { BoomerangProcessor } from './boomerang'
import { BoomerangOptions, ProcessingProgress } from './types'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

// Storage for active jobs
const activeJobs = new Map<string, { ws: any; processor: BoomerangProcessor }>()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads')
    fs.ensureDirSync(uploadDir)
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.m4v']
    const ext = path.extname(file.originalname).toLowerCase()

    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(
        new Error(
          `Unsupported file format "${ext}". Supported formats: ${allowedTypes.join(
            ', '
          )}`
        )
      )
    }
  },
})

// Serve static files
app.use(express.static(path.join(__dirname, '../public')))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
app.use('/output', express.static(path.join(__dirname, '../output')))
app.use(express.json())

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('WebSocket client connected')

  ws.on('close', () => {
    console.log('WebSocket client disconnected')
    // Clean up any active jobs for this client
    for (const [jobId, job] of activeJobs.entries()) {
      if (job.ws === ws) {
        activeJobs.delete(jobId)
      }
    }
  })
})

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Upload and process video
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' })
    }

    const jobId = uuidv4()
    const inputPath = req.file.path
    const outputDir = path.join(__dirname, '../output')
    await fs.ensureDir(outputDir)

    // Parse options from request body
    const options: BoomerangOptions = {
      input: inputPath,
      output: path.join(outputDir, `${jobId}_boomerang.mp4`),
      quality: (req.body.quality || 'medium') as 'high' | 'medium' | 'low',
      preserveAudio: req.body.preserveAudio === 'true',
      verbose: true,
    }

    // Add optional properties if they exist
    if (req.body.fps) {
      options.fps = parseFloat(req.body.fps)
    }
    if (req.body.maxDuration) {
      options.maxDuration = parseFloat(req.body.maxDuration)
    }

    // Find WebSocket client for this request
    const ws = Array.from(wss.clients).find((client) => client.readyState === 1)

    if (!ws) {
      return res.status(400).json({ error: 'No active WebSocket connection' })
    }

    // Create processor and setup progress tracking
    const processor = new BoomerangProcessor(options)
    activeJobs.set(jobId, { ws, processor })

    processor.onProgress((progress: ProcessingProgress) => {
      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: 'progress',
            jobId,
            progress: {
              ...progress,
              fileName: req.file!.originalname,
            },
          })
        )
      }
    })

    // Start processing in background
    processor
      .process()
      .then((result) => {
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              type: 'complete',
              jobId,
              result: {
                ...result,
                downloadUrl: result.success
                  ? `/output/${path.basename(result.outputPath!)}`
                  : null,
                fileName: req.file!.originalname,
              },
            })
          )
        }

        // Clean up input file
        fs.remove(inputPath).catch(console.error)
        activeJobs.delete(jobId)
      })
      .catch((error) => {
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              type: 'error',
              jobId,
              error: error.message,
              fileName: req.file!.originalname,
            })
          )
        }

        // Clean up input file
        fs.remove(inputPath).catch(console.error)
        activeJobs.delete(jobId)
      })

    return res.json({ jobId, status: 'processing' })
  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({ error: (error as Error).message })
  }
})

// Get job status
app.get('/api/job/:jobId', (req, res) => {
  const jobId = req.params.jobId
  const job = activeJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  return res.json({ jobId, status: 'processing' })
})

// Clean up old files periodically
setInterval(async () => {
  const uploadsDir = path.join(__dirname, '../uploads')
  const outputDir = path.join(__dirname, '../output')

  const cleanupDir = async (dir: string) => {
    try {
      if (await fs.pathExists(dir)) {
        const files = await fs.readdir(dir)
        const now = Date.now()

        for (const file of files) {
          const filePath = path.join(dir, file)
          const stat = await fs.stat(filePath)

          // Delete files older than 1 hour
          if (now - stat.mtime.getTime() > 60 * 60 * 1000) {
            await fs.remove(filePath)
            console.log(`Cleaned up old file: ${filePath}`)
          }
        }
      }
    } catch (error) {
      console.error(`Error cleaning up ${dir}:`, error)
    }
  }

  await cleanupDir(uploadsDir)
  await cleanupDir(outputDir)
}, 30 * 60 * 1000) // Run every 30 minutes

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Server error:', error)
    res.status(500).json({ error: error.message })
  }
)

// Start server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`🚀 Boomerang Web Server running on http://localhost:${PORT}`)
  console.log(`📁 Uploads directory: ${path.join(__dirname, '../uploads')}`)
  console.log(`📁 Output directory: ${path.join(__dirname, '../output')}`)
})
