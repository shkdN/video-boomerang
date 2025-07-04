#!/usr/bin/env node

import { program } from 'commander'
import chalk from 'chalk'
import ProgressBar from 'progress'
import * as fs from 'fs-extra'
import { BoomerangProcessor } from './boomerang'
import { BoomerangOptions, ProcessingProgress } from './types'
import { formatDuration, formatFileSize } from './utils'

// Package info
const packageJson = require('../package.json')

/**
 * CLI Application for creating boomerang videos
 */
class BoomerangCLI {
  private progressBar: ProgressBar | null = null

  constructor() {
    this.setupCommander()
  }

  /**
   * Setup Commander.js for CLI argument parsing
   */
  private setupCommander(): void {
    program
      .name('boomerang')
      .description('Create boomerang videos from MP4 files')
      .version(packageJson.version)
      .argument('<input>', 'Input video file path')
      .option('-o, --output <path>', 'Output video file path')
      .option(
        '-q, --quality <quality>',
        'Output quality: high, medium, low',
        'medium'
      )
      .option('-f, --fps <number>', 'Frame rate for output video', parseFloat)
      .option(
        '-d, --max-duration <seconds>',
        'Maximum duration in seconds',
        parseFloat
      )
      .option('-a, --preserve-audio', 'Preserve audio in boomerang', false)
      .option('-t, --temp-dir <path>', 'Temporary directory for processing')
      .option('-v, --verbose', 'Enable verbose logging', false)
      .option('--no-progress', 'Disable progress bar', false)
      .action(async (input: string, options: any) => {
        await this.processVideo(input, options)
      })

    program.parse()
  }

  /**
   * Main video processing function
   */
  private async processVideo(input: string, cliOptions: any): Promise<void> {
    try {
      console.log(chalk.blue.bold('🎬 Video Boomerang Creator'))
      console.log(chalk.gray(`Version ${packageJson.version}\n`))

      // Validate input file exists
      if (!(await fs.pathExists(input))) {
        console.error(
          chalk.red(`❌ Error: Input file "${input}" does not exist`)
        )
        process.exit(1)
      }

      // Validate quality option
      const validQualities = ['high', 'medium', 'low']
      if (!validQualities.includes(cliOptions.quality)) {
        console.error(
          chalk.red(
            `❌ Error: Invalid quality "${
              cliOptions.quality
            }". Valid options: ${validQualities.join(', ')}`
          )
        )
        process.exit(1)
      }

      // Convert CLI options to BoomerangOptions
      const options: BoomerangOptions = {
        input,
        output: cliOptions.output,
        quality: cliOptions.quality as 'high' | 'medium' | 'low',
        fps: cliOptions.fps,
        maxDuration: cliOptions.maxDuration,
        preserveAudio: cliOptions.preserveAudio,
        tempDir: cliOptions.tempDir,
        verbose: cliOptions.verbose,
      }

      // Show input info
      const inputStats = await fs.stat(input)
      console.log(chalk.cyan('📁 Input:'), input)
      console.log(chalk.cyan('📊 Size:'), formatFileSize(inputStats.size))

      if (options.output) {
        console.log(chalk.cyan('📁 Output:'), options.output)
      }

      console.log(chalk.cyan('⚙️  Quality:'), options.quality)

      if (options.maxDuration) {
        console.log(
          chalk.cyan('⏱️  Max Duration:'),
          formatDuration(options.maxDuration)
        )
      }

      if (options.preserveAudio) {
        console.log(chalk.cyan('🎵 Audio:'), 'Preserved')
      }

      console.log() // Empty line

      // Create processor and setup progress tracking
      const processor = new BoomerangProcessor(options)

      if (!cliOptions.noProgress) {
        processor.onProgress((progress: ProcessingProgress) => {
          this.updateProgress(progress)
        })
      }

      // Process the video
      const result = await processor.process()

      // Handle result
      if (result.success) {
        this.showSuccess(result, options)
      } else {
        this.showError(result.error!)
        process.exit(1)
      }
    } catch (error) {
      this.showError(error as Error)
      process.exit(1)
    }
  }

  /**
   * Update progress bar and status
   */
  private updateProgress(progress: ProcessingProgress): void {
    const stageEmojis = {
      analyzing: '🔍',
      processing: '⚙️',
      concatenating: '🔗',
      finalizing: '✨',
    }

    // Create or update progress bar
    if (!this.progressBar || progress.progress === 0) {
      if (this.progressBar) {
        this.progressBar.terminate()
      }

      this.progressBar = new ProgressBar(
        `${
          stageEmojis[progress.stage]
        } [:bar] :percent :current/:total :etas | :status`,
        {
          complete: '█',
          incomplete: '░',
          width: 30,
          total: 100,
          clear: false,
        }
      )
    }

    // Update progress bar
    if (this.progressBar) {
      this.progressBar.update(progress.progress / 100, {
        status: progress.currentStep,
      })

      // Complete the bar if we're at 100%
      if (progress.progress >= 100) {
        this.progressBar.terminate()
        console.log(chalk.green('✅ Processing complete!\n'))
      }
    }
  }

  /**
   * Show success message and results
   */
  private showSuccess(result: any, options: BoomerangOptions): void {
    console.log(chalk.green.bold('🎉 Boomerang created successfully!'))
    console.log()

    console.log(chalk.cyan('📁 Output file:'), result.outputPath)

    if (result.metadata) {
      console.log(
        chalk.cyan('📺 Dimensions:'),
        `${result.metadata.width}x${result.metadata.height}`
      )
      console.log(
        chalk.cyan('🎬 Frame rate:'),
        `${result.metadata.fps.toFixed(1)} fps`
      )
      console.log(
        chalk.cyan('⏱️  Duration:'),
        formatDuration(result.metadata.duration * 2)
      ) // x2 for boomerang
    }

    console.log(
      chalk.cyan('⏱️  Processing time:'),
      `${(result.processingTime / 1000).toFixed(1)}s`
    )

    // Show output file size
    try {
      const outputStats = require('fs').statSync(result.outputPath)
      console.log(
        chalk.cyan('📊 Output size:'),
        formatFileSize(outputStats.size)
      )
    } catch (error) {
      // Ignore if we can't get output size
    }

    console.log()
    console.log(
      chalk.gray(
        '💡 Tip: Use -v for verbose output, or --help for more options'
      )
    )
  }

  /**
   * Show error message
   */
  private showError(error: Error): void {
    console.log()
    console.error(chalk.red.bold('❌ Error occurred:'))
    console.error(chalk.red(error.message))

    if (error.name === 'BoomerangError') {
      const boomerangError = error as any
      if (boomerangError.code === 'FFMPEG_ERROR') {
        console.log()
        console.log(chalk.yellow('💡 FFmpeg troubleshooting:'))
        console.log(
          chalk.gray(
            '• Make sure FFmpeg is installed: https://ffmpeg.org/download.html'
          )
        )
        console.log(
          chalk.gray(
            '• On Windows: Add FFmpeg to your PATH environment variable'
          )
        )
        console.log(
          chalk.gray('• On macOS: Install with Homebrew: brew install ffmpeg')
        )
        console.log(
          chalk.gray(
            '• On Linux: Install with your package manager: apt install ffmpeg'
          )
        )
      } else if (boomerangError.code === 'UNSUPPORTED_FORMAT') {
        console.log()
        console.log(
          chalk.yellow(
            '💡 Supported formats: .mp4, .avi, .mov, .mkv, .webm, .m4v'
          )
        )
      }
    }

    console.log()
    console.log(chalk.gray('For more help, run: boomerang --help'))
  }
}

// Run the CLI app
if (require.main === module) {
  new BoomerangCLI()
}
