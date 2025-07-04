import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import {
  BoomerangOptions,
  BoomerangResult,
  VideoMetadata,
  ProcessingProgress,
  BoomerangError,
  ERROR_CODES,
} from './types'
import {
  validateInputFile,
  validateVideoFormat,
  validateFFmpeg,
  generateOutputPath,
  createTempDir,
  cleanup,
  getVideoMetadata,
  formatDuration,
} from './utils'

export class BoomerangProcessor {
  private options: BoomerangOptions
  private tempDir: string = ''
  private metadata: VideoMetadata | null = null
  private progressCallback?: (progress: ProcessingProgress) => void

  constructor(options: BoomerangOptions) {
    this.options = { ...this.getDefaultOptions(), ...options }
  }

  public onProgress(callback: (progress: ProcessingProgress) => void): void {
    this.progressCallback = callback
  }

  public async process(): Promise<BoomerangResult> {
    const startTime = Date.now()

    try {
      await this.validateEnvironment()
      this.metadata = await this.analyzeVideo()
      await this.setupProcessing()
      const outputPath = await this.createBoomerang()
      await this.cleanup()

      const processingTime = Date.now() - startTime

      if (this.options.verbose) {
        console.log(`✅ Boomerang created successfully in ${processingTime}ms`)
        console.log(`📁 Output: ${outputPath}`)
      }

      return {
        success: true,
        outputPath,
        metadata: this.metadata,
        processingTime,
      }
    } catch (error) {
      await this.cleanup()

      const processingTime = Date.now() - startTime
      const boomerangError =
        error instanceof BoomerangError
          ? error
          : new BoomerangError(
              `Unexpected error: ${(error as Error).message}`,
              ERROR_CODES.PROCESSING_ERROR,
              error as Error
            )

      return {
        success: false,
        error: boomerangError,
        processingTime,
      }
    }
  }

  private async validateEnvironment(): Promise<void> {
    this.reportProgress('analyzing', 0, 'Validating environment...')
    await validateFFmpeg()
    await validateInputFile(this.options.input)
    validateVideoFormat(this.options.input)
    this.reportProgress('analyzing', 25, 'Environment validated')
  }

  private async analyzeVideo(): Promise<VideoMetadata> {
    this.reportProgress('analyzing', 50, 'Analyzing video metadata...')

    const metadata = await getVideoMetadata(this.options.input)

    if (
      this.options.maxDuration &&
      metadata.duration > this.options.maxDuration
    ) {
      if (this.options.verbose) {
        console.log(
          `⚠️  Video will be trimmed to ${formatDuration(
            this.options.maxDuration
          )}`
        )
      }
    }

    if (metadata.duration < 0.5) {
      throw new BoomerangError(
        'Video is too short for boomerang effect (minimum 0.5 seconds)',
        ERROR_CODES.INVALID_INPUT
      )
    }

    if (this.options.verbose) {
      console.log(
        `📺 Video: ${metadata.width}x${
          metadata.height
        } @ ${metadata.fps.toFixed(1)}fps`
      )
      console.log(`⏱️  Duration: ${formatDuration(metadata.duration)}`)
    }

    this.reportProgress('analyzing', 100, 'Video analysis complete')
    return metadata
  }

  private async setupProcessing(): Promise<void> {
    this.tempDir = await createTempDir(this.options.tempDir)

    if (this.options.verbose) {
      console.log(`📁 Temp directory: ${this.tempDir}`)
    }
  }

  private async createBoomerang(): Promise<string> {
    if (!this.metadata) {
      throw new BoomerangError(
        'Video metadata not available',
        ERROR_CODES.PROCESSING_ERROR
      )
    }

    const outputPath = generateOutputPath(
      this.options.input,
      this.options.output
    )
    const forwardPath = path.join(this.tempDir, 'forward.mp4')
    const reversePath = path.join(this.tempDir, 'reverse.mp4')

    await this.createForwardVideo(forwardPath)
    await this.createReverseVideo(forwardPath, reversePath)
    await this.concatenateVideos(forwardPath, reversePath, outputPath)

    return outputPath
  }

  private async createForwardVideo(outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.reportProgress('processing', 10, 'Creating forward video...')

      let command = ffmpeg(this.options.input)

      if (
        this.options.maxDuration &&
        this.metadata!.duration > this.options.maxDuration
      ) {
        command = command.setStartTime(0).setDuration(this.options.maxDuration)
      }

      command = this.applyQualitySettings(command)

      if (this.options.fps) {
        command = command.fps(this.options.fps)
      }

      if (!this.options.preserveAudio) {
        command = command.noAudio()
      }

      command
        .output(outputPath)
        .on('progress', (progress: any) => {
          const percent = Math.min(
            Math.round((progress.percent || 0) * 0.4),
            40
          )
          this.reportProgress(
            'processing',
            10 + percent,
            `Processing forward video... ${percent}%`
          )
        })
        .on('end', () => {
          this.reportProgress('processing', 50, 'Forward video created')
          resolve()
        })
        .on('error', (err: Error) => {
          reject(
            new BoomerangError(
              `Failed to create forward video: ${err.message}`,
              ERROR_CODES.FFMPEG_ERROR,
              err
            )
          )
        })
        .run()
    })
  }

  private async createReverseVideo(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.reportProgress('processing', 50, 'Creating reverse video...')

      let command = ffmpeg(inputPath).videoFilters('reverse').output(outputPath)

      if (!this.options.preserveAudio) {
        command = command.noAudio()
      } else {
        command = command.audioFilters('areverse')
      }

      command
        .on('progress', (progress: any) => {
          const percent = Math.min(
            Math.round((progress.percent || 0) * 0.3),
            30
          )
          this.reportProgress(
            'processing',
            50 + percent,
            `Creating reverse video... ${percent}%`
          )
        })
        .on('end', () => {
          this.reportProgress('processing', 80, 'Reverse video created')
          resolve()
        })
        .on('error', (err: Error) => {
          reject(
            new BoomerangError(
              `Failed to create reverse video: ${err.message}`,
              ERROR_CODES.FFMPEG_ERROR,
              err
            )
          )
        })
        .run()
    })
  }

  private async concatenateVideos(
    forwardPath: string,
    reversePath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.reportProgress('concatenating', 80, 'Concatenating videos...')

      const fs = require('fs')
      const concatListPath = path.join(this.tempDir, 'concat.txt')
      const concatList = `file '${forwardPath}'\nfile '${reversePath}'`
      fs.writeFileSync(concatListPath, concatList)

      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('progress', (progress: any) => {
          const percent = Math.min(
            Math.round((progress.percent || 0) * 0.2),
            20
          )
          this.reportProgress(
            'concatenating',
            80 + percent,
            `Concatenating... ${percent}%`
          )
        })
        .on('end', () => {
          this.reportProgress('finalizing', 100, 'Boomerang complete!')
          resolve()
        })
        .on('error', (err: Error) => {
          reject(
            new BoomerangError(
              `Failed to concatenate videos: ${err.message}`,
              ERROR_CODES.FFMPEG_ERROR,
              err
            )
          )
        })
        .run()
    })
  }

  private applyQualitySettings(command: any): any {
    switch (this.options.quality) {
      case 'high':
        return command
          .videoBitrate('8000k')
          .outputOptions(['-preset', 'medium'])
      case 'medium':
        return command.videoBitrate('4000k').outputOptions(['-preset', 'fast'])
      case 'low':
        return command
          .videoBitrate('2000k')
          .outputOptions(['-preset', 'faster'])
      default:
        return command.videoBitrate('4000k').outputOptions(['-preset', 'fast'])
    }
  }

  private reportProgress(
    stage: ProcessingProgress['stage'],
    progress: number,
    currentStep: string
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        progress,
        currentStep,
      })
    }
  }

  private async cleanup(): Promise<void> {
    if (this.tempDir) {
      await cleanup(this.tempDir, this.options.verbose)
    }
  }

  private getDefaultOptions(): Partial<BoomerangOptions> {
    return {
      quality: 'medium',
      preserveAudio: false,
      verbose: false,
    }
  }
}

export async function createBoomerang(
  options: BoomerangOptions
): Promise<BoomerangResult> {
  const processor = new BoomerangProcessor(options)
  return processor.process()
}
