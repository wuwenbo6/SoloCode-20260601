<template>
  <el-card class="voice-card">
    <template #header>
      <div class="card-header">
        <el-icon :size="20" :color="isListening ? '#F56C6C' : '#909399'"><Microphone /></el-icon>
        <span>语音控制</span>
        <el-tag v-if="!isSupported" type="danger" size="small" style="margin-left: 10px;">
          浏览器不支持语音识别
        </el-tag>
      </div>
    </template>

    <div class="voice-container">
      <div
        class="mic-button"
        :class="{ listening: isListening, disabled: !isSupported }"
        @click="toggleListening"
      >
        <el-icon :size="48">
          <Microphone v-if="!isListening" />
          <Connection v-else />
        </el-icon>
      </div>

      <div class="voice-status">
        <template v-if="isListening">
          <div class="listening-animation">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p class="status-text">正在聆听...</p>
        </template>
        <template v-else-if="isProcessing">
          <el-icon class="loading-icon" :size="24"><Loading /></el-icon>
          <p class="status-text">正在处理...</p>
        </template>
        <template v-else>
          <p class="status-text">点击麦克风开始语音控制</p>
        </template>
      </div>

      <div v-if="transcript" class="transcript-box">
        <div class="label">识别文本：</div>
        <div class="content">{{ transcript }}</div>
      </div>

      <div v-if="lastResult" class="result-box" :class="lastResult.success ? 'success' : 'error'">
        <div class="label">执行结果：</div>
        <div class="content">{{ lastResult.message }}</div>
      </div>

      <div class="command-hints">
        <div class="hints-title">试试说：</div>
        <div class="hints-grid">
          <el-tag size="small" @click="sendTextCommand('打开空调')">打开空调</el-tag>
          <el-tag size="small" @click="sendTextCommand('关闭灯光')">关闭灯光</el-tag>
          <el-tag size="small" @click="sendTextCommand('把空调调到24度')">把空调调到24度</el-tag>
          <el-tag size="small" @click="sendTextCommand('灯光亮度调到75%')">灯光亮度调到75%</el-tag>
          <el-tag size="small" @click="sendTextCommand('离家模式')">离家模式</el-tag>
          <el-tag size="small" @click="sendTextCommand('回家模式')">回家模式</el-tag>
          <el-tag size="small" @click="sendTextCommand('睡眠模式')">睡眠模式</el-tag>
          <el-tag size="small" @click="sendTextCommand('观影模式')">观影模式</el-tag>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, Connection, Loading } from '@element-plus/icons-vue'
import { useIotStore } from '../stores/iotStore'

const store = useIotStore()

const isSupported = ref(false)
const isListening = ref(false)
const isProcessing = ref(false)
const transcript = ref('')
const lastResult = ref(null)
let recognition = null

const checkSupport = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (SpeechRecognition) {
    isSupported.value = true
    recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'zh-CN'

    recognition.onstart = () => {
      isListening.value = true
      transcript.value = ''
      lastResult.value = null
    }

    recognition.onresult = async (event) => {
      const result = event.results[0][0].transcript
      transcript.value = result
      isListening.value = false
      await processCommand(result)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      isListening.value = false
      if (event.error !== 'no-speech') {
        ElMessage.error(`语音识别错误: ${event.error}`)
      }
    }

    recognition.onend = () => {
      isListening.value = false
    }
  }
}

const toggleListening = () => {
  if (!isSupported.value) {
    ElMessage.warning('您的浏览器不支持语音识别功能，请使用Chrome浏览器')
    return
  }

  if (isListening.value) {
    recognition.stop()
  } else {
    transcript.value = ''
    lastResult.value = null
    recognition.start()
  }
}

const processCommand = async (text) => {
  isProcessing.value = true
  try {
    const result = await store.executeVoiceCommand(text)
    lastResult.value = result
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.warning(result.message)
    }
  } catch (e) {
    ElMessage.error('指令执行失败')
  } finally {
    isProcessing.value = false
  }
}

const sendTextCommand = async (text) => {
  transcript.value = text
  await processCommand(text)
}

onMounted(() => {
  checkSupport()
})

onBeforeUnmount(() => {
  if (recognition && isListening.value) {
    recognition.stop()
  }
})
</script>

<style scoped>
.voice-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.voice-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.mic-button {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.mic-button:hover:not(.disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.mic-button.listening {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
  animation: pulse 1.5s infinite;
}

.mic-button.disabled {
  background: #ccc;
  cursor: not-allowed;
  box-shadow: none;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.voice-status {
  margin-top: 20px;
  text-align: center;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.listening-animation {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 30px;
  margin-bottom: 10px;
}

.listening-animation span {
  width: 4px;
  background: #f5576c;
  border-radius: 2px;
  animation: wave 1s infinite ease-in-out;
}

.listening-animation span:nth-child(1) { animation-delay: 0s; height: 10px; }
.listening-animation span:nth-child(2) { animation-delay: 0.2s; height: 20px; }
.listening-animation span:nth-child(3) { animation-delay: 0.4s; height: 15px; }
.listening-animation span:nth-child(4) { animation-delay: 0.6s; height: 25px; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1); }
}

.status-text {
  color: #606266;
  margin: 0;
  font-size: 14px;
}

.loading-icon {
  color: #409EFF;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.transcript-box, .result-box {
  width: 100%;
  max-width: 400px;
  margin-top: 15px;
  padding: 12px 16px;
  border-radius: 8px;
  text-align: left;
}

.transcript-box {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
}

.result-box.success {
  background: #f0f9eb;
  border: 1px solid #67c23a;
  color: #67c23a;
}

.result-box.error {
  background: #fef0f0;
  border: 1px solid #f56c6c;
  color: #f56c6c;
}

.label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.content {
  font-size: 14px;
  font-weight: 500;
}

.command-hints {
  width: 100%;
  max-width: 400px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e4e7ed;
}

.hints-title {
  font-size: 13px;
  color: #909399;
  margin-bottom: 10px;
}

.hints-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hints-grid .el-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.hints-grid .el-tag:hover {
  transform: translateY(-2px);
}
</style>
