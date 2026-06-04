import type { VstHostConfig, VstPluginInfo, VstRpcMessage, VstEffectParams } from '@/types/audio'

const DEFAULT_HOST_CONFIG: VstHostConfig = {
  hostPath: '',
  rpcPort: 8080,
  isConnected: false,
  plugins: [],
}

export class VstHostClient {
  private config: VstHostConfig = { ...DEFAULT_HOST_CONFIG }
  private socket: WebSocket | null = null
  private pendingRequests: Map<string, { resolve: (result: any) => void; reject: (error: string) => void }> = new Map()
  private messageIdCounter = 0
  private reconnectTimer: number | null = null

  constructor() {
    this.loadConfig()
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem('vstHostConfig')
      if (saved) {
        this.config = JSON.parse(saved)
      }
    } catch (e) {
      console.warn('Failed to load VST host config:', e)
    }
  }

  private saveConfig() {
    try {
      localStorage.setItem('vstHostConfig', JSON.stringify(this.config))
    } catch (e) {
      console.warn('Failed to save VST host config:', e)
    }
  }

  private generateMessageId(): string {
    return `vst_${Date.now()}_${this.messageIdCounter++}`
  }

  async connect(hostPath: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close()
      }

      this.config.hostPath = hostPath
      this.config.rpcPort = port
      this.saveConfig()

      const wsUrl = `ws://localhost:${port}`
      console.log(`Connecting to VST host at ${wsUrl}...`)

      try {
        this.socket = new WebSocket(wsUrl)

        this.socket.onopen = () => {
          console.log('Connected to VST host')
          this.config.isConnected = true
          this.saveConfig()
          resolve(true)
        }

        this.socket.onmessage = (event) => {
          try {
            const message: VstRpcMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (e) {
            console.error('Failed to parse VST message:', e)
          }
        }

        this.socket.onerror = (error) => {
          console.error('VST host connection error:', error)
          this.config.isConnected = false
          resolve(false)
        }

        this.socket.onclose = () => {
          console.log('Disconnected from VST host')
          this.config.isConnected = false
          this.scheduleReconnect()
        }
      } catch (e) {
        console.error('Failed to create VST host connection:', e)
        this.config.isConnected = false
        resolve(false)
      }
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    if (this.config.hostPath) {
      this.reconnectTimer = window.setTimeout(() => {
        if (!this.config.isConnected) {
          console.log('Attempting to reconnect to VST host...')
          this.connect(this.config.hostPath, this.config.rpcPort)
        }
      }, 5000)
    }
  }

  private handleMessage(message: VstRpcMessage) {
    const pending = this.pendingRequests.get(message.id)
    if (pending) {
      if (message.error) {
        pending.reject(message.error)
      } else {
        pending.resolve(message.result)
      }
      this.pendingRequests.delete(message.id)
    }
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to VST host')
    }

    const id = this.generateMessageId()
    const message: VstRpcMessage = { id, method, params }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error('Request timeout'))
      }, 30000)

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout)
          resolve(result)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(new Error(error))
        },
      })

      this.socket.send(JSON.stringify(message))
    })
  }

  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.config.isConnected = false
  }

  async scanPlugins(): Promise<VstPluginInfo[]> {
    try {
      const plugins = await this.sendRequest('scanPlugins')
      this.config.plugins = plugins
      this.saveConfig()
      return plugins
    } catch (e) {
      console.error('Failed to scan plugins:', e)
      return []
    }
  }

  async getPluginList(): Promise<VstPluginInfo[]> {
    if (this.config.plugins.length === 0 && this.config.isConnected) {
      await this.scanPlugins()
    }
    return this.config.plugins
  }

  async createPluginInstance(pluginId: string): Promise<string> {
    return this.sendRequest('createPlugin', { pluginId })
  }

  async destroyPluginInstance(instanceId: string): Promise<void> {
    return this.sendRequest('destroyPlugin', { instanceId })
  }

  async setPluginParameter(instanceId: string, paramId: string, value: number): Promise<void> {
    return this.sendRequest('setParameter', { instanceId, paramId, value })
  }

  async getPluginParameter(instanceId: string, paramId: string): Promise<number> {
    return this.sendRequest('getParameter', { instanceId, paramId })
  }

  async getAllPluginParameters(instanceId: string): Promise<Record<string, number>> {
    return this.sendRequest('getAllParameters', { instanceId })
  }

  async setPluginBypass(instanceId: string, bypassed: boolean): Promise<void> {
    return this.sendRequest('setBypass', { instanceId, bypassed })
  }

  async openPluginEditor(instanceId: string): Promise<void> {
    return this.sendRequest('openEditor', { instanceId })
  }

  async closePluginEditor(instanceId: string): Promise<void> {
    return this.sendRequest('closeEditor', { instanceId })
  }

  async processAudio(
    instanceId: string,
    input: Float32Array[],
    sampleRate: number
  ): Promise<Float32Array[]> {
    return this.sendRequest('processAudio', {
      instanceId,
      input: input.map(ch => Array.from(ch)),
      sampleRate,
    })
  }

  async savePluginState(instanceId: string): Promise<string> {
    return this.sendRequest('saveState', { instanceId })
  }

  async loadPluginState(instanceId: string, state: string): Promise<void> {
    return this.sendRequest('loadState', { instanceId, state })
  }

  getConfig(): VstHostConfig {
    return { ...this.config }
  }

  isConnected(): boolean {
    return this.config.isConnected
  }
}

export const vstHostClient = new VstHostClient()

export class VstPluginNode {
  private audioContext: AudioContext
  private params: VstEffectParams
  private instanceId: string | null = null
  private inputNode: GainNode
  private outputNode: GainNode
  private bypassGain: GainNode
  private phaseGain: GainNode
  private scriptProcessor: ScriptProcessorNode | null = null

  constructor(audioContext: AudioContext, initialParams: VstEffectParams) {
    this.audioContext = audioContext
    this.params = initialParams
    this.inputNode = audioContext.createGain()
    this.outputNode = audioContext.createGain()
    this.bypassGain = audioContext.createGain()
    this.phaseGain = audioContext.createGain()
    this.bypassGain.gain.value = initialParams.bypassed ? 1 : 0
    this.phaseGain.gain.value = initialParams.phaseInvert ? -1 : 1

    this.inputNode.connect(this.phaseGain)
    this.phaseGain.connect(this.outputNode)
    this.inputNode.connect(this.bypassGain)
    this.bypassGain.connect(this.outputNode)
  }

  async init(): Promise<void> {
    if (!this.params.pluginId || !vstHostClient.isConnected()) {
      console.warn('VST plugin not available, using bypass mode')
      return
    }

    try {
      this.instanceId = await vstHostClient.createPluginInstance(this.params.pluginId)

      Object.entries(this.params.parameters).forEach(([paramId, value]) => {
        vstHostClient.setPluginParameter(this.instanceId!, paramId, value)
      })

      this.createScriptProcessor()
    } catch (e) {
      console.error('Failed to initialize VST plugin:', e)
    }
  }

  private createScriptProcessor() {
    const bufferSize = 1024
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 2, 2)

    this.scriptProcessor.onaudioprocess = async (e) => {
      if (!this.instanceId || this.params.bypassed) {
        const inputL = e.inputBuffer.getChannelData(0)
        const inputR = e.inputBuffer.getChannelData(1)
        const outputL = e.outputBuffer.getChannelData(0)
        const outputR = e.outputBuffer.getChannelData(1)
        outputL.set(inputL)
        outputR.set(inputR)
        return
      }

      try {
        const input = [
          e.inputBuffer.getChannelData(0),
          e.inputBuffer.getChannelData(1),
        ]
        const output = await vstHostClient.processAudio(
          this.instanceId,
          input,
          this.audioContext.sampleRate
        )
        if (output && output.length >= 2) {
          e.outputBuffer.copyToChannel(new Float32Array(output[0]), 0)
          e.outputBuffer.copyToChannel(new Float32Array(output[1]), 1)
        }
      } catch (err) {
        const inputL = e.inputBuffer.getChannelData(0)
        const inputR = e.inputBuffer.getChannelData(1)
        const outputL = e.outputBuffer.getChannelData(0)
        const outputR = e.outputBuffer.getChannelData(1)
        outputL.set(inputL)
        outputR.set(inputR)
      }
    }
  }

  getInput(): AudioNode {
    return this.inputNode
  }

  getOutput(): AudioNode {
    return this.outputNode
  }

  setParams(params: Partial<VstEffectParams>) {
    this.params = { ...this.params, ...params }

    if (this.instanceId) {
      if (params.parameters) {
        Object.entries(params.parameters).forEach(([paramId, value]) => {
          vstHostClient.setPluginParameter(this.instanceId!, paramId, value)
        })
      }
      if (params.bypassed !== undefined) {
        vstHostClient.setPluginBypass(this.instanceId, params.bypassed)
      }
    }

    this.updateBypass()
    this.updatePhase()
  }

  private updateBypass() {
    if (this.params.bypassed) {
      this.bypassGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01)
    } else {
      this.bypassGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01)
    }
  }

  private updatePhase() {
    if (this.params.phaseInvert) {
      this.phaseGain.gain.setTargetAtTime(-1, this.audioContext.currentTime, 0.01)
    } else {
      this.phaseGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01)
    }
  }

  async openEditor() {
    if (this.instanceId) {
      await vstHostClient.openPluginEditor(this.instanceId)
    }
  }

  async closeEditor() {
    if (this.instanceId) {
      await vstHostClient.closePluginEditor(this.instanceId)
    }
  }

  dispose() {
    if (this.instanceId) {
      vstHostClient.destroyPluginInstance(this.instanceId)
      this.instanceId = null
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor.onaudioprocess = null
      this.scriptProcessor = null
    }
    this.inputNode.disconnect()
    this.outputNode.disconnect()
    this.bypassGain.disconnect()
    this.phaseGain.disconnect()
  }
}
