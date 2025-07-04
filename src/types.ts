export interface BoomerangOptions {
  /** Input video file path */
  input: string
  /** Output video file path (optional, will auto-generate if not provided) */
  output?: string
  /** Quality setting: 'high' | 'medium' | 'low' */
  quality: 'high' | 'medium' | 'low'
  /** Frame rate for output video */
  fps?: number
  /** Maximum duration in seconds (will trim if longer) */
  maxDuration?: number
  /** Whether to preserve audio */
  preserveAudio: boolean
  /** Temporary directory for processing */
  tempDir?: string
  /** Enable verbose logging */
  verbose: boolean
}

export interface VideoMetadata {
  duration: number
  fps: number
  width: number
  height: number
  hasAudio: boolean
  format: string
  bitrate?: number
}

export interface ProcessingProgress {
  stage: 'analyzing' | 'processing' | 'concatenating' | 'finalizing'
  progress: number
  timeRemaining?: number
  currentStep: string
}

export interface BoomerangResult {
  success: boolean
  outputPath?: string
  metadata?: VideoMetadata
  processingTime: number
  error?: Error
}

export class BoomerangError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'BoomerangError'
  }
}

export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  FFMPEG_ERROR: 'FFMPEG_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  OUTPUT_ERROR: 'OUTPUT_ERROR',
} as const
