<template>
  <div class="broadcast-view-page">
    <div class="page-header">
      <h2>
        <el-icon><Promotion /></el-icon>
        观看直播 - {{ session?.user?.username || '未知' }} @ {{ session?.server?.name || '未知' }}
      </h2>
      <div class="header-actions">
        <el-tag type="success" effect="dark">
          <el-icon><VideoCamera /></el-icon>
          正在直播 ({{ viewerCount }} 人观看)
        </el-tag>
        <el-button :icon="ArrowLeft" @click="$router.back()">返回</el-button>
      </div>
    </div>

    <el-card class="broadcast-card">
      <div v-if="!isConnected && !connecting" class="empty-state">
        <el-empty description="正在准备连接...">
          <el-button type="primary" @click="connect">开始观看</el-button>
        </el-empty>
      </div>

      <div v-else-if="connecting" class="empty-state">
        <el-icon size="48" class="is-loading"><Loading /></el-icon>
        <p>正在连接到直播...</p>
      </div>

      <div ref="terminalContainer" class="terminal-container">
        <div ref="terminalRef" class="terminal"></div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { getSession } from '../api/session'

const route = useRoute()
const authStore = useAuthStore()

const terminalRef = ref(null)
const terminalContainer = ref(null)
const session = ref(null)
const isConnected = ref(false)
const connecting = ref(false)
const viewerCount = ref(0)

let terminal = null
let fitAddon = null
let ws = null
let pingTimer = null
let viewerTimer = null

const initTerminal = () => {
  terminal = new Terminal({
    cursorBlink: false,
    disableStdin: true,
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
  fitAddon.fit()
}

const connect = () => {
  if (!terminal) {
    initTerminal()
  }

  connecting.value = true
  terminal.clear()
  terminal.writeln('\x1b[33m正在连接到直播...\x1b[0m')

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/api/ssh/broadcast/${route.params.id}`

  ws = new WebSocket(wsUrl)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    connecting.value = false
    isConnected.value = true
    terminal.clear()
    ElMessage.success('已连接到直播')

    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'stdout') {
        terminal.write(msg.data)
      }
    } catch (e) {
      terminal.write(new Uint8Array(event.data))
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    ElMessage.error('连接错误')
  }

  ws.onclose = () => {
    if (isConnected.value) {
      ElMessage.warning('直播已结束或连接断开')
    }
    cleanup()
  }
}

const cleanup = () => {
  connecting.value = false
  isConnected.value = false
  if (pingTimer) {
    clearInterval(pingTimer)
    pingTimer = null
  }
  if (viewerTimer) {
    clearInterval(viewerTimer)
    viewerTimer = null
  }
  ws = null
}

const handleResize = () => {
  if (fitAddon) {
    fitAddon.fit()
  }
}

const fetchSession = async () => {
  try {
    const res = await getSession(route.params.id)
    session.value = res.data
    if (res.data.status !== 'active') {
      ElMessage.warning('该会话已结束')
    }
  } catch (err) {
    console.error('Failed to fetch session:', err)
  }
}

onMounted(async () => {
  await fetchSession()
  window.addEventListener('resize', handleResize)
  connect()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (ws) {
    ws.close()
  }
  if (pingTimer) {
    clearInterval(pingTimer)
  }
  if (terminal) {
    terminal.dispose()
  }
})
</script>

<style lang="scss" scoped>
.broadcast-view-page {
  height: 100%;
  display: flex;
  flex-direction: column;

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .broadcast-card {
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

  .empty-state {
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
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
