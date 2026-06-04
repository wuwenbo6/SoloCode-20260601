import { VSTPlugin } from '../types';

export interface VSTBridgeMessage {
  type: 'plugin_list' | 'load_plugin' | 'unload_plugin' | 'parameter_update' | 
        'process_midi' | 'process_audio' | 'error' | 'ping' | 'pong' | 'connect' | 'disconnect';
  payload?: any;
  pluginId?: string;
  timestamp?: number;
}

export interface VSTHostInfo {
  name: string;
  version: string;
  plugins: string[];
}

type ConnectionCallback = (connected: boolean) => void;
type ParameterCallback = (pluginId: string, paramId: string, value: number) => void;
type PluginListCallback = (plugins: string[]) => void;
type ErrorCallback = (error: string) => void;

export class VSTBridge {
  private socket: WebSocket | null = null;
  private host: string = 'ws://localhost:8080';
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private loadedPlugins: Map<string, VSTPlugin> = new Map();
  private availablePlugins: string[] = [];

  private onConnectionCallbacks: ConnectionCallback[] = [];
  private onParameterCallbacks: ParameterCallback[] = [];
  private onPluginListCallbacks: PluginListCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];

  private heartbeatInterval: number | null = null;
  private messageQueue: VSTBridgeMessage[] = [];

  async connect(host?: string): Promise<boolean> {
    if (host) {
      this.host = host;
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.host);

        this.socket.onopen = () => {
          console.log('[VSTBridge] Connected to VST host');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyConnection(true);
          this.startHeartbeat();
          this.flushMessageQueue();
          this.sendMessage({ type: 'plugin_list' });
          resolve(true);
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as VSTBridgeMessage;
            this.handleMessage(message);
          } catch (e) {
            console.error('[VSTBridge] Failed to parse message:', e);
          }
        };

        this.socket.onclose = () => {
          console.log('[VSTBridge] Disconnected from VST host');
          this.isConnected = false;
          this.stopHeartbeat();
          this.notifyConnection(false);

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[VSTBridge] Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
            setTimeout(() => this.connect(), this.reconnectDelay);
          }
        };

        this.socket.onerror = (error) => {
          console.error('[VSTBridge] WebSocket error:', error);
          this.notifyError('WebSocket connection error');
          reject(error);
        };
      } catch (e) {
        console.error('[VSTBridge] Failed to connect:', e);
        reject(e);
      }
    });
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.socket) {
      this.sendMessage({ type: 'disconnect' });
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.stopHeartbeat();
    this.loadedPlugins.clear();
    this.notifyConnection(false);
  }

  private handleMessage(message: VSTBridgeMessage) {
    switch (message.type) {
      case 'plugin_list':
        if (message.payload && Array.isArray(message.payload.plugins)) {
          this.availablePlugins = message.payload.plugins;
          this.notifyPluginList(this.availablePlugins);
        }
        break;

      case 'parameter_update':
        if (message.pluginId && message.payload) {
          const { paramId, value } = message.payload;
          this.notifyParameterUpdate(message.pluginId, paramId, value);
          
          const plugin = this.loadedPlugins.get(message.pluginId);
          if (plugin) {
            const param = plugin.parameters.find(p => p.id === paramId);
            if (param) {
              param.value = value;
            }
          }
        }
        break;

      case 'ping':
        this.sendMessage({ type: 'pong' });
        break;

      case 'pong':
        break;

      case 'error':
        this.notifyError(message.payload?.message || 'Unknown error');
        break;

      case 'connect':
        this.isConnected = true;
        this.notifyConnection(true);
        break;
    }
  }

  private sendMessage(message: VSTBridgeMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.socket.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
      return true;
    } catch (e) {
      console.error('[VSTBridge] Failed to send message:', e);
      this.messageQueue.push(message);
      return false;
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({ type: 'ping' });
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async loadPlugin(pluginName: string, trackId: string): Promise<VSTPlugin | null> {
    if (!this.isConnected) {
      throw new Error('Not connected to VST host');
    }

    return new Promise((resolve, reject) => {
      const pluginId = `vst-${trackId}-${Date.now()}`;
      const timeout = setTimeout(() => {
        reject(new Error('Load plugin timeout'));
      }, 10000);

      const handleParam = (receivedPluginId: string) => {
        if (receivedPluginId === pluginId) {
          clearTimeout(timeout);
          this.onParameterCallbacks = this.onParameterCallbacks.filter(cb => cb !== handleParam as any);
        }
      };
      this.onParameterCallbacks.push(handleParam as any);

      const success = this.sendMessage({
        type: 'load_plugin',
        pluginId,
        payload: {
          name: pluginName,
          trackId
        }
      });

      if (!success) {
        clearTimeout(timeout);
        reject(new Error('Failed to send load plugin request'));
        return;
      }

      const plugin: VSTPlugin = {
        id: pluginId,
        name: pluginName,
        enabled: true,
        path: pluginName,
        parameters: []
      };

      this.loadedPlugins.set(pluginId, plugin);
      resolve(plugin);
    });
  }

  unloadPlugin(pluginId: string) {
    this.sendMessage({
      type: 'unload_plugin',
      pluginId
    });
    this.loadedPlugins.delete(pluginId);
  }

  setParameter(pluginId: string, paramId: string, value: number) {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return;

    const param = plugin.parameters.find(p => p.id === paramId);
    if (!param) return;

    param.value = value;

    this.sendMessage({
      type: 'parameter_update',
      pluginId,
      payload: { paramId, value }
    });
  }

  sendMIDI(pluginId: string, status: number, data1: number, data2: number) {
    this.sendMessage({
      type: 'process_midi',
      pluginId,
      payload: { status, data1, data2 }
    });
  }

  sendNoteOn(pluginId: string, note: number, velocity: number) {
    this.sendMIDI(pluginId, 0x90, note, velocity);
  }

  sendNoteOff(pluginId: string, note: number) {
    this.sendMIDI(pluginId, 0x80, note, 0);
  }

  sendAllNotesOff(pluginId: string) {
    for (let i = 0; i < 128; i++) {
      this.sendNoteOff(pluginId, i);
    }
  }

  processAudio(_pluginId: string, _audioData: Float32Array): Float32Array | null {
    return null;
  }

  getAvailablePlugins(): string[] {
    return this.availablePlugins;
  }

  getLoadedPlugin(pluginId: string): VSTPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  getLoadedPlugins(): VSTPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  isHostConnected(): boolean {
    return this.isConnected;
  }

  onConnection(callback: ConnectionCallback): () => void {
    this.onConnectionCallbacks.push(callback);
    return () => {
      this.onConnectionCallbacks = this.onConnectionCallbacks.filter(cb => cb !== callback);
    };
  }

  onParameterUpdate(callback: ParameterCallback): () => void {
    this.onParameterCallbacks.push(callback);
    return () => {
      this.onParameterCallbacks = this.onParameterCallbacks.filter(cb => cb !== callback);
    };
  }

  onPluginList(callback: PluginListCallback): () => void {
    this.onPluginListCallbacks.push(callback);
    return () => {
      this.onPluginListCallbacks = this.onPluginListCallbacks.filter(cb => cb !== callback);
    };
  }

  onError(callback: ErrorCallback): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyConnection(connected: boolean) {
    this.onConnectionCallbacks.forEach(cb => cb(connected));
  }

  private notifyParameterUpdate(pluginId: string, paramId: string, value: number) {
    this.onParameterCallbacks.forEach(cb => cb(pluginId, paramId, value));
  }

  private notifyPluginList(plugins: string[]) {
    this.onPluginListCallbacks.forEach(cb => cb(plugins));
  }

  private notifyError(error: string) {
    this.onErrorCallbacks.forEach(cb => cb(error));
  }

  dispose() {
    this.disconnect();
    this.onConnectionCallbacks = [];
    this.onParameterCallbacks = [];
    this.onPluginListCallbacks = [];
    this.onErrorCallbacks = [];
    this.messageQueue = [];
  }
}

export const vstBridge = new VSTBridge();
