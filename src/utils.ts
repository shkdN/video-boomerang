import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg'
import { VideoMetadata, BoomerangError, ERROR_CODES } from './types'

/**
 * Validates input file exists and is readable
 */
export async function validateInputFile(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) {
      throw new BoomerangError(
        `Path "${filePath}" is not a file`,
        ERROR_CODES.INVALID_INPUT
      )
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new BoomerangError(
        `File "${filePath}" does not exist`,
        ERROR_CODES.FILE_NOT_FOUND
      )
    }
    throw new BoomerangError(
      `Cannot access file "${filePath}": ${(error as Error).message}`,
      ERROR_CODES.INVALID_INPUT,
      error as Error
    )
  }
}

/**
 * Validates that the file is a supported video format
 */
export function validateVideoFormat(filePath: string): void {
  const supportedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.m4v']
  const ext = path.extname(filePath).toLowerCase()

  if (!supportedExtensions.includes(ext)) {
    throw new BoomerangError(
      `Unsupported file format "${ext}". Supported formats: ${supportedExtensions.join(
        ', '
      )}`,
      ERROR_CODES.UNSUPPORTED_FORMAT
    )
  }
}

/**
 * Generates output file path if not provided
 */
export function generateOutputPath(
  inputPath: string,
  outputPath?: string
): string {
  if (outputPath) {
    return outputPath
  }

  const parsed = path.parse(inputPath)
  return path.join(parsed.dir, `${parsed.name}_boomerang${parsed.ext}`)
}

/**
 * Creates a temporary directory for processing
 */
export async function createTempDir(customDir?: string): Promise<string> {
  const baseDir = customDir || os.tmpdir()
  const tempDir = path.join(
    baseDir,
    `boomerang_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  )
  await fs.ensureDir(tempDir)
  return tempDir
}

/**
 * Cleans up temporary files and directories
 */
export async function cleanup(
  tempDir: string,
  verbose: boolean = false
): Promise<void> {
  try {
    if (verbose) {
      console.log(`🧹 Cleaning up temporary files in ${tempDir}`)
    }
    await fs.remove(tempDir)
  } catch (error) {
    console.warn(
      `Warning: Failed to cleanup temporary directory ${tempDir}:`,
      (error as Error).message
    )
  }
}

/**
 * Extracts video metadata using FFmpeg
 */
export async function getVideoMetadata(
  filePath: string
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: FfprobeData) => {
      if (err) {
        reject(
          new BoomerangError(
            `Failed to read video metadata: ${err.message}`,
            ERROR_CODES.FFMPEG_ERROR,
            err
          )
        )
        return
      }

      try {
        const videoStream = metadata.streams.find(
          (s: any) => s.codec_type === 'video'
        )
        const audioStream = metadata.streams.find(
          (s: any) => s.codec_type === 'audio'
        )

        if (!videoStream) {
          reject(
            new BoomerangError(
              'No video stream found in file',
              ERROR_CODES.INVALID_INPUT
            )
          )
          return
        }

        resolve({
          duration: parseFloat(String(metadata.format.duration || '0')),
          fps:
            parseFloat(videoStream.r_frame_rate?.split('/')[0] || '30') /
            parseFloat(videoStream.r_frame_rate?.split('/')[1] || '1'),
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          hasAudio: !!audioStream,
          format: metadata.format.format_name || 'unknown',
          bitrate: parseInt(String(metadata.format.bit_rate || '0')),
        })
      } catch (error) {
        reject(
          new BoomerangError(
            `Failed to parse video metadata: ${(error as Error).message}`,
            ERROR_CODES.PROCESSING_ERROR,
            error as Error
          )
        )
      }
    })
  })
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Formats duration in human readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Validates FFmpeg installation
 */
export async function validateFFmpeg(): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg.getAvailableFormats((err: any, formats: any) => {
      if (err) {
        reject(
          new BoomerangError(
            "FFmpeg is not installed or not accessible. Please install FFmpeg and ensure it's in your PATH.",
            ERROR_CODES.FFMPEG_ERROR,
            err
          )
        )
        return
      }
      resolve()
    })
  })
}
