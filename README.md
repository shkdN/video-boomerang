# Video Boomerang Creator

A simple tool to create boomerang videos from regular video files. Works both as a command-line tool and through a web interface.

## What it does

Takes your video file and creates a boomerang effect - plays forward, then backward, then loops. Think Instagram boomerangs but for any video format.

## Installation

```bash
pnpm install
```

## Usage

### Web Interface

The easiest way to use it:

```bash
pnpm run web
```

Open http://localhost:3000 in your browser and drag/drop your video file. You can adjust quality, frame rate, and other settings before processing.

### Command Line

```bash
# Basic usage
npx boomerang input.mp4

# With custom settings
npx boomerang input.mp4 -o output.mp4 -q high -f 30 -d 5

# See all options
npx boomerang --help
```

#### Options

- `-o, --output <path>` - Where to save the output
- `-q, --quality <level>` - high, medium, or low (default: medium)
- `-f, --fps <number>` - Frame rate
- `-d, --max-duration <seconds>` - Trim video to this length
- `-a, --preserve-audio` - Keep audio (off by default)
- `-v, --verbose` - Show detailed progress

## Development

```bash
# Start web server in dev mode
pnpm run web

# Build for production
pnpm run build && pnpm run web:prod

# CLI development
pnpm run dev
```

## Requirements

- Node.js 16+
- FFmpeg (needs to be in your PATH)

## How it works

1. Takes your input video
2. Creates a reversed version
3. Concatenates them together
4. Outputs as MP4

Pretty straightforward.

## File support

**Input**: MP4, AVI, MOV, MKV, WebM, M4V
**Output**: MP4

Web interface has a 500MB file limit. CLI doesn't have a built-in limit.

## Troubleshooting

**FFmpeg not found**: Install FFmpeg and make sure it's in your PATH

- Windows: Download from ffmpeg.org
- macOS: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`

**WebSocket issues**: Refresh the page or try a different browser

**Large files**: Use the CLI for better performance with big files

## API

If you want to integrate this into something else:

- `POST /api/upload` - Upload and process video
- `GET /api/health` - Check if server is running
- `GET /output/:filename` - Download processed video

## Contributing

PRs welcome. The code is pretty straightforward - Express server, WebSocket for progress updates, FFmpeg for video processing.

## License

MIT
