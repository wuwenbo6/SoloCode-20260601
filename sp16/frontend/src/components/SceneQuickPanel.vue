<template>
  <el-card class="scene-panel-card">
    <template #header>
      <div class="card-header">
        <el-icon :size="20" color="#909399"><MagicStick /></el-icon>
        <span>快捷场景</span>
      </div>
    </template>

    <div class="scene-grid" v-loading="loading">
      <div
        v-for="scene in enabledScenes"
        :key="scene.id"
        class="scene-card"
        :style="{ borderColor: scene.color }"
        @click="handleExecuteScene(scene)"
      >
        <div class="scene-icon" :style="{ backgroundColor: scene.color + '20', color: scene.color }">
          <el-icon :size="28">
            <component :is="getIconComponent(scene.icon)" />
          </el-icon>
        </div>
        <div class="scene-name">{{ scene.name }}</div>
        <div class="scene-desc">{{ scene.description }}</div>
        <div class="scene-meta">
          <span v-if="scene.last_executed" class="last-used">
            上次: {{ formatTime(scene.last_executed) }}
          </span>
          <span v-else class="never-used">未使用</span>
        </div>
      </div>

      <el-empty v-if="enabledScenes.length === 0" description="暂无可用场景" :image-size="60" />
    </div>

    <div class="batch-control">
      <el-divider content-position="left">批量控制</el-divider>
      <div class="batch-buttons">
        <el-button type="danger" @click="handleTurnOffAll">
          <el-icon><Switch /></el-icon>
          全部关闭
        </el-button>
        <el-button type="success" @click="handleTurnOnAll">
          <el-icon><Promotion /></el-icon>
          全部开启
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  MagicStick,
  Switch,
  Promotion,
  HomeFilled,
  SwitchButton,
  Moon,
  VideoCamera,
  Reading,
  Sunny,
  Star
} from '@element-plus/icons-vue'
import { useIotStore } from '../stores/iotStore'

const store = useIotStore()
const loading = ref(false)

const iconMap = {
  HomeFilled,
  Switch,
  SwitchButton,
  Moon,
  VideoCamera,
  Reading,
  Sunny,
  Star,
  MagicStick
}

const getIconComponent = (iconName) => {
  return iconMap[iconName] || MagicStick
}

const enabledScenes = computed(() => {
  return store.scenes.filter(s => s.enabled)
})

const formatTime = (isoString) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleExecuteScene = async (scene) => {
  try {
    loading.value = true
    const result = await store.executeScene(scene.id)
    if (result.success) {
      ElMessage.success(`已执行场景: ${scene.name}`)
    } else {
      ElMessage.warning(result.message)
    }
  } catch (e) {
    ElMessage.error('场景执行失败')
  } finally {
    loading.value = false
  }
}

const handleTurnOffAll = async () => {
  try {
    await ElMessageBox.confirm('确定要关闭所有设备吗？', '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const result = await store.controlAllDevices({ is_on: false })
    ElMessage.success('已关闭所有设备')
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

const handleTurnOnAll = async () => {
  try {
    await ElMessageBox.confirm('确定要开启所有设备吗？', '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const result = await store.controlAllDevices({ is_on: true, target_temperature: 24, brightness: 75 })
    ElMessage.success('已开启所有设备')
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

onMounted(() => {
  store.fetchScenes()
})
</script>

<style scoped>
.scene-panel-card {
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

.scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.scene-card {
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 15px;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.scene-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  background: white;
}

.scene-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  transition: all 0.3s ease;
}

.scene-card:hover .scene-icon {
  transform: scale(1.1);
}

.scene-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.scene-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  min-height: 32px;
}

.scene-meta {
  margin-top: 8px;
  font-size: 11px;
  color: #c0c4cc;
}

.batch-control {
  margin-top: 20px;
}

.batch-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.batch-buttons .el-button {
  flex: 1;
  max-width: 160px;
}
</style>
