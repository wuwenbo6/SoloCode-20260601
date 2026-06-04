import { ref, reactive } from 'vue'

const MessageType = {
  CLUSTER_STATUS: 'cluster_status',
  TASK_UPDATE: 'task_update',
  SUBMIT_TASK: 'submit_task',
  TASK_LOG: 'task_log',
  TASK_LOG_REQUEST: 'task_log_request',
  TASK_RESULT: 'task_result'
}

const logHandlers = []

export function useClusterWebSocket() {
  const ws = ref(null)
  const connected = ref(false)
  const nodes = ref([])
  const tasks = ref([])
  const taskDetails = reactive({})

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//localhost:8080/ws`
    
    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('WebSocket connected')
      connected.value = true
    }

    ws.value.onclose = () => {
      console.log('WebSocket disconnected')
      connected.value = false
      setTimeout(connect, 3000)
    }

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleMessage(data)
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    }
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case MessageType.CLUSTER_STATUS:
        handleClusterStatus(msg.payload)
        break
      case MessageType.TASK_UPDATE:
        handleTaskUpdate(msg.payload)
        break
      case MessageType.TASK_LOG:
        handleTaskLog(msg.payload)
        break
      case MessageType.TASK_RESULT:
        console.log('Task result:', msg.payload)
        break
    }
  }

  function handleClusterStatus(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload
    nodes.value = data.nodes || []
    tasks.value = data.tasks || []
  }

  function handleTaskUpdate(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload
    taskDetails[data.taskId] = data

    const taskIndex = tasks.value.findIndex(t => t.id === data.taskId)
    if (taskIndex !== -1) {
      tasks.value[taskIndex].status = data.status
      tasks.value[taskIndex].progress = data.progress
    }
  }

  function handleTaskLog(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload
    logHandlers.forEach(handler => {
      try {
        handler(data)
      } catch (e) {
        console.error('Log handler error:', e)
      }
    })
  }

  function submitTask(type, params, options = {}) {
    if (!connected.value || !ws.value) {
      return Promise.reject('Not connected')
    }

    const msg = {
      type: MessageType.SUBMIT_TASK,
      payload: {
        type,
        params,
        priority: options.priority || 1,
        affinity_tags: options.affinityTags || [],
        anti_affinity: options.antiAffinity || [],
        preferred_nodes: options.preferredNodes || []
      }
    }

    ws.value.send(JSON.stringify(msg))
    return Promise.resolve()
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close()
    }
  }

  function getInstance() {
    return ws.value
  }

  function registerLogHandler(handler) {
    logHandlers.push(handler)
    return () => {
      const index = logHandlers.indexOf(handler)
      if (index > -1) {
        logHandlers.splice(index, 1)
      }
    }
  }

  return {
    connected,
    nodes,
    tasks,
    taskDetails,
    connect,
    disconnect,
    submitTask,
    getInstance,
    registerLogHandler
  }
}
