#!/usr/bin/env node

/**
 * Setup script for Video Boomerang Creator
 * Helps users install dependencies and validate their environment
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🎬 Video Boomerang Creator - Setup Script')
console.log('==========================================\n')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkCommand(command, name) {
  try {
    execSync(command, { stdio: 'ignore' })
    log(`✅ ${name} is installed`, 'green')
    return true
  } catch (error) {
    log(`❌ ${name} is not installed or not in PATH`, 'red')
    return false
  }
}

function runCommand(command, description) {
  try {
    log(`📦 ${description}...`, 'blue')
    execSync(command, { stdio: 'inherit' })
    log(`✅ ${description} completed`, 'green')
    return true
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red')
    return false
  }
}

async function main() {
  log('🔍 Checking prerequisites...', 'cyan')

  // Check Node.js version
  const nodeVersion = process.version
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])

  if (majorVersion >= 16) {
    log(`✅ Node.js ${nodeVersion} (compatible)`, 'green')
  } else {
    log(
      `❌ Node.js ${nodeVersion} is too old. Please upgrade to 16.0.0 or higher`,
      'red'
    )
    process.exit(1)
  }

  // Check for npm
  if (!checkCommand('npm --version', 'npm')) {
    log('Please install Node.js and npm from https://nodejs.org/', 'yellow')
    process.exit(1)
  }

  // Check for FFmpeg
  if (!checkCommand('ffmpeg -version', 'FFmpeg')) {
    log('\n🛠️  FFmpeg Installation Instructions:', 'yellow')
    log(
      'Windows: Download from https://ffmpeg.org/download.html and add to PATH'
    )
    log('macOS: brew install ffmpeg')
    log('Linux: sudo apt install ffmpeg (Ubuntu/Debian) or equivalent')
    log('\nAfter installing FFmpeg, run this script again.', 'yellow')
    process.exit(1)
  }

  console.log()

  // Install dependencies
  if (!runCommand('npm install', 'Installing dependencies')) {
    process.exit(1)
  }

  console.log()

  // Build the project
  if (!runCommand('npm run build', 'Building TypeScript project')) {
    process.exit(1)
  }

  console.log()

  // Create examples directory
  const examplesDir = path.join(process.cwd(), 'examples')
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir)
    log('📁 Created examples directory', 'green')
  }

  // Success message
  log('🎉 Setup completed successfully!', 'green')
  console.log()
  log('📖 Quick start:', 'bright')
  log('  npx ts-node src/index.ts your-video.mp4', 'cyan')
  log('  npm start -- your-video.mp4 -q high -v', 'cyan')
  console.log()
  log('📚 For more examples, see the README.md file', 'blue')
  console.log()
  log('🚀 Happy boomerang making!', 'bright')
}

main().catch(console.error)
