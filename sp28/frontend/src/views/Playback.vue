<template>
  <div class="playback-page">
    <div class="page-header">
      <h2>
        <el-icon><VideoPlay /></el-icon>
        终端回放 - {{ session?.server?.name || '未知' }}
      </h2>
      <el-button :icon="ArrowLeft" @click="$router.back()">返回</el-button>
    </div>

    <el-card class="playback-card">
      <div v-if="loading" class="loading-state">
        <el-icon size="48" class="is-loading"><Loading /></el-icon>
        <p>加载录制数据...</p>
      </div>

      <div v-else-if="!frames.length" class="empty-state">
        <el-empty description="无录制数据" />
      </div>

      <div v-else ref="terminalContainer" class="terminal-container">
        <div ref="terminalRef" class="terminal"></div>
      </div>

      <div v-if="frames.length" class="control-bar">
        <div class="progress-bar" @click="handleProgressClick">
          <div class="progress-filled" :style="{ width: progressPercent }"></div>
          <div class="progress-handle" :style="{ left: progressPercent }"></div>
        </div>

        <div class="controls">
          <div class="left-controls">
            <el-button circle :icon="isPlaying ? VideoPause : VideoPlay" @click="togglePlay" />
            <el-button circle :icon="Back" @click="skipBackward" />
            <el-button circle :icon="Right" @click="skipForward" />
          </div>

          <div class="center-info">
            <span class="time-display">{{ formatTime(playbackElapsed) }} / {{ formatTime(originalDuration) }}</span>
          </div>

          <div class="right-controls">
            <span class="speed-label">速度:</span>
            <el-radio-group v-model="playbackSpeed" size="small" @change="handleSpeedChange">
              <el-radio-button :value="0.25">0.25x</el-radio-button>
              <el-radio-button :value="0.5">0.5x</el-radio-button>
              <el-radio-button :value="1">1x</el-radio-button>
              <el-radio-button :value="2">2x</el-radio-button>
              <el-radio-button :value="4">4x</el-radio-button>
              <el-radio-button :value="8">8x</el-radio-button>
              <el-radio-button :value="16">16x</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getPlaybackFrames } from '../api/playback'
import { getSession } from '../api/session'

const route = useRoute()

const terminalRef = ref(null)
const terminalContainer = ref(null)
const loading = ref(false)
const frames = ref([])
const session = ref(null)
const originalDuration = ref(0)
const isPlaying = ref(false)
const playbackSpeed = ref(1)

let terminal = null
let fitAddon = null
let animFrameId = null

let playbackStartTime = 0
let playbackPausedAt = 0
let currentFrameIndex = -1
let playbackElapsed = ref(0)

const progressPercent = computed(() => {
  if (originalDuration.value <= 0) return '0%'
  return `${(playbackElapsed.value / originalDuration.value) * 100}%`
})

const initTerminal = () => {
  terminal = new Terminal({
    cursorBlink: false,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#aeafad',
      selectionBackground: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff'
    },
    scrollback: 5000
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)

  terminal.open(terminalRef.value)
  try {
    fitAddon.fit()
  } catch (e) {
    console.warn('Initial fit failed:', e)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const [sessionRes, framesRes] = await Promise.all([
      getSession(route.params.id),
      getPlaybackFrames(route.params.id, playbackSpeed.value)
    ])
    session.value = sessionRes.data
    frames.value = framesRes.data.frames
    originalDuration.value = framesRes.data.duration
    currentFrameIndex = -1
    playbackElapsed.value = 0
    playbackPausedAt = 0
    if (terminal) {
      terminal.clear()
    }
  } finally {
    loading.value = false
  }
}

const getElapsedSinceStart = () => {
  if (!isPlaying.value) {
    return playbackPausedAt
  }
  const wallElapsed = (performance.now() - playbackStartTime) / 1000
  return playbackPausedAt + wallElapsed * playbackSpeed.value
}

const animationLoop = () => {
  if (!isPlaying.value) return

  const elapsed = getElapsedSinceStart()
  playbackElapsed.value = Math.min(elapsed, originalDuration.value)

  while (currentFrameIndex + 1 < frames.value.length) {
    const nextFrame = frames.value[currentFrameIndex + 1]
    if (nextFrame.absolute_ts <= elapsed) {
      terminal.write(nextFrame.content)
      currentFrameIndex++
    } else {
      break
    }
  }

  if (currentFrameIndex >= frames.value.length - 1 && elapsed >= originalDuration.value) {
    isPlaying.value = false
    playbackPausedAt = originalDuration.value
    playbackElapsed.value = originalDuration.value
    return
  }

  animFrameId = requestAnimationFrame(animationLoop)
}

const startPlayback = () => {
  if (currentFrameIndex >= frames.value.length - 1 && playbackPausedAt >= originalDuration.value) {
    seekToTime(0)
  }

  isPlaying.value = true
  playbackStartTime = performance.now()
  animFrameId = requestAnimationFrame(animationLoop)
}

const pausePlayback = () => {
  isPlaying.value = false
  playbackPausedAt = getElapsedSinceStart()
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}

const togglePlay = () => {
  if (isPlaying.value) {
    pausePlayback()
  } else {
    startPlayback()
  }
}

const seekToTime = (targetTime) => {
  const wasPlaying = isPlaying.value
  if (wasPlaying) {
    pausePlayback()
  }

  targetTime = Math.max(0, Math.min(targetTime, originalDuration.value))

  const targetFrameIdx = findFrameIndexAtTime(targetTime)

  terminal.clear()

  for (let i = 0; i <= targetFrameIdx; i++) {
    terminal.write(frames.value[i].content)
  }

  currentFrameIndex = targetFrameIdx
  playbackPausedAt = targetTime
  playbackElapsed.value = targetTime

  if (wasPlaying) {
    startPlayback()
  }
}

const findFrameIndexAtTime = (targetTime) => {
  let left = 0
  let right = frames.value.length - 1
  let result = 0

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (frames.value[mid].absolute_ts <= targetTime) {
      result = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return result
}

const skipBackward = () => {
  const target = Math.max(0, playbackElapsed.value - 10)
  seekToTime(target)
}

const skipForward = () => {
  const target = Math.min(originalDuration.value, playbackElapsed.value + 10)
  seekToTime(target)
}

const handleProgressClick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = x / rect.width
  const targetTime = percentage * originalDuration.value
  seekToTime(targetTime)
}

const handleSpeedChange = async () => {
  const wasPlaying = isPlaying.value
  const currentElapsed = playbackElapsed.value

  if (wasPlaying) {
    pausePlayback()
  }

  loading.value = true
  try {
    const framesRes = await getPlaybackFrames(route.params.id, playbackSpeed.value)
    frames.value = framesRes.data.frames
    originalDuration.value = framesRes.data.duration
  } finally {
    loading.value = false
  }

  seekToTime(currentElapsed)

  if (wasPlaying) {
    startPlayback()
  }
}

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

onMounted(async () => {
  initTerminal()
  await loadData()
})

onBeforeUnmount(() => {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
  }
  if (terminal) {
    terminal.dispose()
  }
})
</script>

<style lang="scss" scoped>
.playback-page {
  height: 100%;
  display: flex;
  flex-direction: column;

  .playback-card {
    flex: 1;
    padding: 0;
    display: flex;
    flex-direction: column;

    :deep(.el-card__body) {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
    }
  }

  .loading-state, .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #909399;

    .is-loading {
      animation: rotate 1s linear infinite;
    }

    p {
      margin-top: 16px;
    }
  }

  .terminal-container {
    flex: 1;
    background: #1e1e1e;
    display: flex;
    padding: 16px;

    .terminal {
      flex: 1;
      height: 100%;
    }
  }

  .control-bar {
    background: #fff;
    padding: 16px 24px;
    border-top: 1px solid #ebeef5;

    .progress-bar {
      position: relative;
      height: 8px;
      background: #ebeef5;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 16px;

      .progress-filled {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: #409eff;
        border-radius: 4px;
        transition: width 0.05s linear;
      }

      .progress-handle {
        position: absolute;
        top: 50%;
        width: 16px;
        height: 16px;
        background: #409eff;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
    }

    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .left-controls, .right-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .center-info {
        .time-display {
          font-family: monospace;
          font-size: 14px;
          color: #606266;
        }
      }

      .speed-label {
        font-size: 14px;
        color: #606266;
        margin-right: 8px;
      }
    }
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
