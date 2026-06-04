<template>
  <div class="terminal-page">
    <div class="page-header">
      <h2>
        <el-icon><Connection /></el-icon>
        SSH 终端
      </h2>
      <div class="header-actions">
        <el-select
          v-model="selectedServerId"
          placeholder="选择服务器"
          style="width: 240px"
          :disabled="isConnected"
          @change="handleServerChange"
        >
          <el-option
            v-for="server in accessibleServers"
            :key="server.id"
            :label="`${server.name} (${server.host})`"
            :value="server.id"
          />
        </el-select>
        <el-button
          type="primary"
          :icon="isConnected ? SwitchButton : Right"
          @click="isConnected ? disconnect() : connect()"
          :disabled="!selectedServerId"
        >
          {{ isConnected ? '断开连接' : '连接' }}
        </el-button>
      </div>
    </div>

    <el-card class="terminal-card">
      <div v-if="!isConnected && !connecting" class="empty-state">
        <el-empty description="请选择服务器并点击连接">
          <el-button type="primary" @click="refreshServers">刷新服务器列表</el-button>
        </el-empty>
      </div>

      <div v-else-if="connecting" class="empty-state">
        <el-icon size="48" class="is-loading"><Loading /></el-icon>
        <p>正在连接服务器...</p>
      </div>

      <div ref="terminalContainer" class="terminal-container">
        <div ref="terminalRef" class="terminal"></div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { getMyGrants } from '../api/access'
import { getServers } from '../api/server'

const route = useRoute()
const authStore = useAuthStore()

const terminalRef = ref(null)
const terminalContainer = ref(null)
const selectedServerId = ref(null)
const isConnected = ref(false)
const connecting = ref(false)
const accessibleServers = ref([])
const allServers = ref([])

let terminal = null
let fitAddon = null
let ws = null
let pingTimer = null
let resizeDebounceTimer = null
let lastSentCols = 0
let lastSentRows = 0

const initTerminal = () => {
  terminal = new Terminal({
    cursorBlink: true,
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
  terminal.loadAddon(new WebLinksAddon())

  terminal.open(terminalRef.value)
  try {
    fitAddon.fit()
  } catch (e) {
    console.warn('Initial fit failed:', e)
  }

  terminal.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stdin', data }))
    }
  })
}

const sendResize = (cols, rows) => {
  if (cols === lastSentCols && rows === lastSentRows) return
  if (cols <= 0 || rows <= 0) return
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  lastSentCols = cols
  lastSentRows = rows
  ws.send(JSON.stringify({
    type: 'resize',
    data: JSON.stringify({ cols, rows })
  }))
}

const debouncedFitAndResize = () => {
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }
  resizeDebounceTimer = setTimeout(() => {
    if (!fitAddon || !terminal) return
    try {
      fitAddon.fit()
    } catch (e) {
      console.warn('Fit failed:', e)
      return
    }
    const dims = fitAddon.proposeDimensions()
    if (dims) {
      sendResize(dims.cols, dims.rows)
    }
  }, 100)
}

const connect = () => {
  if (!selectedServerId.value) return

  connecting.value = true

  if (!terminal) {
    initTerminal()
  }
  terminal.clear()
  terminal.writeln('\x1b[33m正在连接到服务器...\x1b[0m')

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/api/ssh/connect?server_id=${selectedServerId.value}`

  ws = new WebSocket(wsUrl)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    connecting.value = false
    isConnected.value = true
    ElMessage.success('已连接到服务器')

    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    nextTick(() => {
      try {
        fitAddon.fit()
      } catch (e) {
        console.warn('Fit on open failed:', e)
      }
      const dims = fitAddon.proposeDimensions()
      if (dims) {
        sendResize(dims.cols, dims.rows)
      }
    })
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
      ElMessage.warning('与服务器的连接已断开')
    }
    cleanup()
  }
}

const disconnect = () => {
  ElMessageBox.confirm('确定要断开连接吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'close' }))
      ws.close()
    }
  }).catch(() => {})
}

const cleanup = () => {
  connecting.value = false
  isConnected.value = false
  if (pingTimer) {
    clearInterval(pingTimer)
    pingTimer = null
  }
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
    resizeDebounceTimer = null
  }
  lastSentCols = 0
  lastSentRows = 0
  ws = null
}

const refreshServers = async () => {
  try {
    const [grantsRes, serversRes] = await Promise.all([
      getMyGrants(),
      getServers()
    ])
    allServers.value = serversRes.data
    const grantedServerIds = grantsRes.data.map(g => g.server_id)
    accessibleServers.value = serversRes.data.filter(s => grantedServerIds.includes(s.id))
  } catch (err) {
    console.error('Failed to load servers:', err)
  }
}

const handleServerChange = () => {
  if (isConnected.value) {
    disconnect()
  }
}

watch(() => route.params.serverId, (serverId) => {
  if (serverId && !isConnected.value) {
    selectedServerId.value = parseInt(serverId)
    connect()
  }
}, { immediate: true })

onMounted(() => {
  refreshServers()
  window.addEventListener('resize', debouncedFitAndResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', debouncedFitAndResize)
  if (ws) {
    ws.close()
  }
  if (pingTimer) {
    clearInterval(pingTimer)
  }
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }
  if (terminal) {
    terminal.dispose()
  }
})
</script>

<style lang="scss" scoped>
.terminal-page {
  height: 100%;
  display: flex;
  flex-direction: column;

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .terminal-card {
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
