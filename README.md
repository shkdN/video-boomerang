# 🎬 Video Boomerang Creator

A professional Node.js tool for creating boomerang videos from MP4 files. Built with TypeScript, FFmpeg, and engineered for reliability and ease of use.

## ✨ Features

- **High-Quality Processing**: Uses FFmpeg for professional video processing
- **Multiple Quality Settings**: Choose from high, medium, or low quality output
- **Smart Duration Handling**: Automatically handles long videos with optional trimming
- **Progress Tracking**: Real-time progress bars and status updates
- **Audio Support**: Option to preserve or remove audio
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **CLI & Programmatic**: Use as a command-line tool or import as a library
- **Error Recovery**: Robust error handling with helpful troubleshooting tips

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16.0.0 or higher
- **FFmpeg** installed and accessible in your PATH

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Install globally (optional)
npm link
```

### Basic Usage

```bash
# Create a boomerang from input.mp4
npx ts-node src/index.ts input.mp4

# Specify output file and quality
npx ts-node src/index.ts input.mp4 -o output_boomerang.mp4 -q high

# Limit duration and preserve audio
npx ts-node src/index.ts input.mp4 -d 3 -a

# Show detailed progress
npx ts-node src/index.ts input.mp4 -v
```

## 📖 Command Line Options

```
Usage: boomerang <input> [options]

Arguments:
  input                    Input video file path

Options:
  -V, --version            Display version number
  -o, --output <path>      Output video file path
  -q, --quality <quality>  Output quality: high, medium, low (default: "medium")
  -f, --fps <number>       Frame rate for output video
  -d, --max-duration <seconds> Maximum duration in seconds
  -a, --preserve-audio     Preserve audio in boomerang
  -t, --temp-dir <path>    Temporary directory for processing
  -v, --verbose           Enable verbose logging
  --no-progress           Disable progress bar
  -h, --help              Display help for command
```

## 💻 Programmatic Usage

```typescript
import { createBoomerang, BoomerangProcessor } from './src/boomerang'

// Simple usage
const result = await createBoomerang({
  input: 'input.mp4',
  output: 'output.mp4',
  quality: 'high',
  preserveAudio: false,
  verbose: true,
})

if (result.success) {
  console.log('Boomerang created:', result.outputPath)
} else {
  console.error('Error:', result.error?.message)
}

// Advanced usage with progress tracking
const processor = new BoomerangProcessor({
  input: 'input.mp4',
  quality: 'medium',
  maxDuration: 5,
  preserveAudio: true,
  verbose: false,
})

processor.onProgress((progress) => {
  console.log(
    `${progress.stage}: ${progress.progress}% - ${progress.currentStep}`
  )
})

const result = await processor.process()
```

## ⚙️ Configuration Options

| Option          | Type                          | Default          | Description                    |
| --------------- | ----------------------------- | ---------------- | ------------------------------ |
| `input`         | `string`                      | **required**     | Path to input video file       |
| `output`        | `string`                      | `auto-generated` | Path for output video file     |
| `quality`       | `'high' \| 'medium' \| 'low'` | `'medium'`       | Output video quality           |
| `fps`           | `number`                      | `original`       | Frame rate for output video    |
| `maxDuration`   | `number`                      | `unlimited`      | Maximum duration in seconds    |
| `preserveAudio` | `boolean`                     | `false`          | Whether to include audio       |
| `tempDir`       | `string`                      | `system temp`    | Temporary processing directory |
| `verbose`       | `boolean`                     | `false`          | Enable detailed logging        |

## 🎨 Quality Settings

- **High**: 8000k bitrate, medium preset (best quality, slower processing)
- **Medium**: 4000k bitrate, fast preset (balanced quality/speed)
- **Low**: 2000k bitrate, faster preset (smaller files, faster processing)

## 📁 Supported Formats

**Input formats**: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.m4v`
**Output format**: `.mp4` (H.264)

## 🛠️ FFmpeg Installation

### Windows

1. Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add `C:\ffmpeg\bin` to your PATH environment variable

### macOS

```bash
# Using Homebrew
brew install ffmpeg

# Using MacPorts
sudo port install ffmpeg
```

### Linux

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

## 📊 Performance

Processing times vary based on:

- Input video duration and resolution
- Quality settings
- System hardware (CPU, disk speed)
- FFmpeg version and configuration

**Typical performance** (on modern hardware):

- 1080p, 5-second video: ~10-30 seconds
- 720p, 3-second video: ~5-15 seconds
- 480p, 2-second video: ~3-8 seconds

## 🔧 Development

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Build project
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 📝 Examples

### Basic Boomerang

```bash
# Create a simple boomerang
boomerang vacation.mp4
# Output: vacation_boomerang.mp4
```

### High-Quality Short Clip

```bash
# High quality, 2-second maximum duration
boomerang dance.mp4 -q high -d 2 -o dance_loop.mp4
```

### Social Media Optimized

```bash
# Medium quality, 3 seconds, no audio (perfect for Instagram/TikTok)
boomerang celebration.mp4 -q medium -d 3 -o celebration_social.mp4
```

### Preserve Original Audio

```bash
# Keep audio for videos with important sound
boomerang music_video.mp4 -a -q high -o music_boomerang.mp4
```

## 🐛 Troubleshooting

### FFmpeg Not Found

- **Windows**: Ensure FFmpeg is in your PATH
- **macOS/Linux**: Install via package manager or compile from source
- Test with: `ffmpeg -version`

### Memory Issues

- Use lower quality settings for large videos
- Specify a temp directory with more space: `-t /path/to/large/disk`
- Process shorter segments with `-d` option

### Slow Processing

- Lower quality setting: `-q low`
- Reduce frame rate: `-f 24`
- Use SSD for temp directory
- Limit duration: `-d 5`

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 🙏 Acknowledgments

- Built with [FFmpeg](https://ffmpeg.org/) - the leading multimedia framework
- Uses [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) for Node.js integration
- CLI powered by [Commander.js](https://github.com/tj/commander.js)
- Beautiful output with [Chalk](https://github.com/chalk/chalk)

---

**Made with ❤️ by a Senior 10x Engineer**
