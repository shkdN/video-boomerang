// Global variables
let selectedFile = null
let currentJobId = null
let websocket = null

// DOM elements
const uploadArea = document.getElementById('uploadArea')
const videoInput = document.getElementById('videoInput')
const uploadSection = document.getElementById('uploadSection')
const uploadInfo = document.getElementById('uploadInfo')
const fileName = document.getElementById('fileName')
const fileSize = document.getElementById('fileSize')
const removeFile = document.getElementById('removeFile')
const configSection = document.getElementById('configSection')
const processBtn = document.getElementById('processBtn')
const progressSection = document.getElementById('progressSection')
const progressFill = document.getElementById('progressFill')
const progressPercent = document.getElementById('progressPercent')
const progressStage = document.getElementById('progressStage')
const progressStep = document.getElementById('progressStep')
const progressFileName = document.getElementById('progressFileName')
const resultSection = document.getElementById('resultSection')
const resultSuccess = document.getElementById('resultSuccess')
const resultError = document.getElementById('resultError')
const downloadBtn = document.getElementById('downloadBtn')
const newVideoBtn = document.getElementById('newVideoBtn')
const tryAgainBtn = document.getElementById('tryAgainBtn')
const errorMessage = document.getElementById('errorMessage')
const processingTime = document.getElementById('processingTime')
const videoDimensions = document.getElementById('videoDimensions')
const videoFps = document.getElementById('videoFps')

// Initialize WebSocket connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}`

  websocket = new WebSocket(wsUrl)

  websocket.onopen = function (event) {
    console.log('WebSocket connected')
  }

  websocket.onmessage = function (event) {
    const data = JSON.parse(event.data)
    handleWebSocketMessage(data)
  }

  websocket.onclose = function (event) {
    console.log('WebSocket disconnected')
    // Attempt to reconnect after 3 seconds
    setTimeout(initWebSocket, 3000)
  }

  websocket.onerror = function (error) {
    console.error('WebSocket error:', error)
  }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'progress':
      updateProgress(data.progress)
      break
    case 'complete':
      handleProcessingComplete(data.result)
      break
    case 'error':
      handleProcessingError(data.error)
      break
  }
}

// File upload handling
function setupFileUpload() {
  // Click to browse
  uploadArea.addEventListener('click', () => {
    videoInput.click()
  })

  // File input change
  videoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  })

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault()
    uploadArea.classList.add('drag-over')
  })

  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault()
    uploadArea.classList.remove('drag-over')
  })

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault()
    uploadArea.classList.remove('drag-over')

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  })

  // Remove file
  removeFile.addEventListener('click', (e) => {
    e.stopPropagation()
    clearFileSelection()
  })
}

// Handle file selection
function handleFileSelect(file) {
  // Validate file type
  const allowedTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
  ]
  if (!allowedTypes.includes(file.type)) {
    alert('Please select a valid video file (MP4, AVI, MOV, WebM)')
    return
  }

  // Validate file size (500MB limit)
  if (file.size > 500 * 1024 * 1024) {
    alert('File size must be less than 500MB')
    return
  }

  selectedFile = file

  // Update UI
  fileName.textContent = file.name
  fileSize.textContent = formatFileSize(file.size)

  uploadSection.style.display = 'none'
  uploadInfo.style.display = 'block'
  configSection.style.display = 'block'
}

// Clear file selection
function clearFileSelection() {
  selectedFile = null
  videoInput.value = ''

  uploadSection.style.display = 'block'
  uploadInfo.style.display = 'none'
  configSection.style.display = 'none'
  progressSection.style.display = 'none'
  resultSection.style.display = 'none'
}

// Format file size
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// Format duration
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Process video
async function processVideo() {
  if (!selectedFile) {
    alert('Please select a video file first')
    return
  }

  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    alert('WebSocket connection not available. Please refresh the page.')
    return
  }

  // Get configuration values
  const quality = document.getElementById('quality').value
  const fps = document.getElementById('fps').value
  const maxDuration = document.getElementById('maxDuration').value
  const preserveAudio = document.getElementById('preserveAudio').checked

  // Prepare form data
  const formData = new FormData()
  formData.append('video', selectedFile)
  formData.append('quality', quality)
  if (fps) formData.append('fps', fps)
  if (maxDuration) formData.append('maxDuration', maxDuration)
  formData.append('preserveAudio', preserveAudio)

  // Update UI
  processBtn.disabled = true
  processBtn.querySelector('span').textContent = 'Processing...'
  processBtn.querySelector('.btn-spinner').style.display = 'block'

  configSection.style.display = 'none'
  progressSection.style.display = 'block'
  progressFileName.textContent = `Processing: ${selectedFile.name}`

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (response.ok) {
      currentJobId = result.jobId
      console.log('Upload successful, job ID:', currentJobId)
    } else {
      throw new Error(result.error || 'Upload failed')
    }
  } catch (error) {
    console.error('Upload error:', error)
    handleProcessingError(error.message)
  }
}

// Update progress
function updateProgress(progress) {
  progressFill.style.width = `${progress.progress}%`
  progressPercent.textContent = `${Math.round(progress.progress)}%`

  // Update stage
  const stageNames = {
    analyzing: 'Analyzing',
    processing: 'Processing',
    concatenating: 'Concatenating',
    finalizing: 'Finalizing',
  }

  progressStage.textContent = stageNames[progress.stage] || progress.stage
  progressStep.textContent = progress.currentStep
}

// Handle processing complete
function handleProcessingComplete(result) {
  progressSection.style.display = 'none'
  resultSection.style.display = 'block'

  if (result.success) {
    resultSuccess.style.display = 'block'
    resultError.style.display = 'none'

    // Update result info
    processingTime.textContent = `${(result.processingTime / 1000).toFixed(1)}s`

    if (result.metadata) {
      videoDimensions.textContent = `${result.metadata.width}x${result.metadata.height}`
      videoFps.textContent = `${result.metadata.fps.toFixed(1)} fps`
    }

    // Set download URL
    if (result.downloadUrl) {
      downloadBtn.onclick = () => {
        window.open(result.downloadUrl, '_blank')
      }
    }
  } else {
    handleProcessingError(result.error?.message || 'Processing failed')
  }

  // Reset process button
  processBtn.disabled = false
  processBtn.querySelector('span').textContent = 'Create Boomerang'
  processBtn.querySelector('.btn-spinner').style.display = 'none'
}

// Handle processing error
function handleProcessingError(error) {
  progressSection.style.display = 'none'
  resultSection.style.display = 'block'
  resultSuccess.style.display = 'none'
  resultError.style.display = 'block'

  errorMessage.textContent = error

  // Reset process button
  processBtn.disabled = false
  processBtn.querySelector('span').textContent = 'Create Boomerang'
  processBtn.querySelector('.btn-spinner').style.display = 'none'
}

// Reset UI for new video
function resetForNewVideo() {
  clearFileSelection()
  currentJobId = null

  // Reset progress
  progressFill.style.width = '0%'
  progressPercent.textContent = '0%'
  progressStage.textContent = 'Starting...'
  progressStep.textContent = 'Initializing...'

  // Reset form
  document.getElementById('quality').value = 'medium'
  document.getElementById('fps').value = ''
  document.getElementById('maxDuration').value = ''
  document.getElementById('preserveAudio').checked = false
}

// Event listeners
function setupEventListeners() {
  processBtn.addEventListener('click', processVideo)
  newVideoBtn.addEventListener('click', resetForNewVideo)
  tryAgainBtn.addEventListener('click', () => {
    resultSection.style.display = 'none'
    configSection.style.display = 'block'
  })
}

// Initialize app
function init() {
  setupFileUpload()
  setupEventListeners()
  initWebSocket()

  console.log('Video Boomerang Creator initialized')
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init)

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden
    console.log('Page hidden')
  } else {
    // Page is visible
    console.log('Page visible')
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      initWebSocket()
    }
  }
})

// Handle beforeunload
window.addEventListener('beforeunload', (event) => {
  if (currentJobId) {
    event.preventDefault()
    event.returnValue =
      'Video processing is in progress. Are you sure you want to leave?'
  }
})
