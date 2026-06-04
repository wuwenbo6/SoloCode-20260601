import { useState, useEffect, useCallback } from 'react'
import {
  Plug,
  Unplug,
  RefreshCw,
  Settings,
  Sliders,
  Power,
  Search,
  ExternalLink,
} from 'lucide-react'
import { vstHostClient } from '@/audio/vstHost'
import type { VstPluginInfo, VstHostConfig } from '@/types/audio'

interface VstManagerProps {
  onClose?: () => void
  onSelectPlugin?: (plugin: VstPluginInfo) => void
}

export function VstManager({ onClose, onSelectPlugin }: VstManagerProps) {
  const [config, setConfig] = useState<VstHostConfig>(vstHostClient.getConfig())
  const [plugins, setPlugins] = useState<VstPluginInfo[]>([])
  const [isConnecting, setIsConnecting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [hostPath, setHostPath] = useState(config.hostPath)
  const [hostPort, setHostPort] = useState(config.rpcPort.toString())

  useEffect(() => {
    const currentConfig = vstHostClient.getConfig()
    setConfig(currentConfig)
    setHostPath(currentConfig.hostPath)
    setHostPort(currentConfig.rpcPort.toString())
    
    if (currentConfig.isConnected) {
      loadPlugins()
    }
  }, [])

  const loadPlugins = useCallback(async () => {
    setIsScanning(true)
    try {
      const pluginList = await vstHostClient.getPluginList()
      setPlugins(pluginList)
    } catch (e) {
      console.error('Failed to load plugins:', e)
    } finally {
      setIsScanning(false)
    }
  }, [])

  const handleConnect = useCallback(async () => {
    setIsConnecting(true)
    try {
      const port = parseInt(hostPort, 10)
      const success = await vstHostClient.connect(hostPath, port)
      if (success) {
        setConfig(vstHostClient.getConfig())
        await loadPlugins()
      }
    } catch (e) {
      console.error('Failed to connect:', e)
    } finally {
      setIsConnecting(false)
    }
  }, [hostPath, hostPort, loadPlugins])

  const handleDisconnect = useCallback(async () => {
    await vstHostClient.disconnect()
    setConfig(vstHostClient.getConfig())
    setPlugins([])
  }, [])

  const handleScan = useCallback(async () => {
    setIsScanning(true)
    try {
      const pluginList = await vstHostClient.scanPlugins()
      setPlugins(pluginList)
    } catch (e) {
      console.error('Failed to scan plugins:', e)
    } finally {
      setIsScanning(false)
    }
  }, [])

  const filteredPlugins = plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'effect':
        return 'bg-blue-500'
      case 'instrument':
        return 'bg-purple-500'
      case 'synth':
        return 'bg-pink-500'
      case 'eq':
        return 'bg-green-500'
      case 'compressor':
        return 'bg-yellow-500'
      case 'reverb':
        return 'bg-cyan-500'
      case 'delay':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              config.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <h3 className="text-white font-medium">VST 插件管理器</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-colors ${
              showSettings
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="设置"
          >
            <Settings size={16} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              <Power size={16} />
            </button>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <h4 className="text-white text-sm font-medium mb-3">VST 宿主配置</h4>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">
                宿主路径
              </label>
              <input
                type="text"
                value={hostPath}
                onChange={(e) => setHostPath(e.target.value)}
                placeholder="path/to/vst/host.exe"
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                disabled={config.isConnected}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">
                RPC 端口
              </label>
              <input
                type="number"
                value={hostPort}
                onChange={(e) => setHostPort(e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                disabled={config.isConnected}
              />
            </div>
            <div className="flex gap-2">
              {!config.isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 rounded text-sm transition-colors"
                >
                  {isConnecting ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Plug size={14} />
                  )}
                  {isConnecting ? '连接中...' : '连接宿主'}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm transition-colors"
                >
                  <Unplug size={14} />
                  断开连接
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            <p>需要运行本地 VST 宿主程序才能使用第三方插件。</p>
            <p className="mt-1">宿主程序通过 WebSocket RPC 与浏览器通信。</p>
          </div>
        </div>
      )}

      {config.isConnected && (
        <>
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索插件..."
                  className="w-full bg-gray-700 text-white rounded pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded transition-colors"
                title="扫描插件"
              >
                <RefreshCw
                  size={16}
                  className={isScanning ? 'animate-spin' : ''}
                />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredPlugins.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Plug size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {plugins.length === 0
                    ? '未找到插件，请确保 VST 宿主已扫描插件目录'
                    : '未找到匹配的插件'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {filteredPlugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="p-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => onSelectPlugin?.(plugin)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded flex items-center justify-center ${getCategoryColor(
                          plugin.category
                        )}`}
                      >
                        <Sliders size={20} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm truncate">
                            {plugin.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            v{plugin.version}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">
                            {plugin.vendor}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="text-xs text-gray-400">
                            {plugin.category}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="text-xs text-gray-400">
                            {plugin.numInputs}→{plugin.numOutputs}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-cyan-400">
                            {plugin.parameters.length} 个参数
                          </span>
                        </div>
                      </div>
                      {onSelectPlugin && (
                        <button
                          className="p-1.5 rounded bg-gray-700 hover:bg-cyan-600 text-gray-300 hover:text-white transition-colors"
                          title="添加到轨道"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <span>共 {plugins.length} 个插件</span>
            <span>
              连接状态:{' '}
              <span className={config.isConnected ? 'text-green-400' : 'text-red-400'}>
                {config.isConnected ? '已连接' : '未连接'}
              </span>
            </span>
          </div>
        </>
      )}

      {!config.isConnected && !showSettings && (
        <div className="p-8 text-center">
          <Plug size={48} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 mb-2">VST 宿主未连接</p>
          <p className="text-gray-500 text-sm mb-4">
            点击设置按钮配置并连接到本地 VST 宿主
          </p>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm transition-colors"
          >
            打开设置
          </button>
        </div>
      )}
    </div>
  )
}
