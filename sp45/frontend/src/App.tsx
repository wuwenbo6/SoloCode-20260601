import { useState } from 'react';
import { Monitor, Cpu, Settings, Printer, Eye, Layers, Network } from 'lucide-react';
import { ConnectionPanel } from './components/ConnectionPanel';
import { StatusPanel } from './components/StatusPanel';
import { ControlPanel } from './components/ControlPanel';
import { VideoMonitor } from './components/VideoMonitor';
import { FirmwareUpgrade } from './components/FirmwareUpgrade';
import { PrintHistory } from './components/PrintHistory';
import { FailureDetection } from './components/FailureDetection';
import { MultiPrinterPanel } from './components/MultiPrinterPanel';
import { GCodePreview } from './components/GCodePreview';
import { usePrinterStatus } from './hooks/usePrinterStatus';
import { useWebUSB } from './hooks/useWebUSB';
import { cn } from './utils';

type TabType = 'control' | 'gcode' | 'printers' | 'detection' | 'firmware' | 'history' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('control');
  const { status, tempHistory, connected: wsConnected, startSimulation } = usePrinterStatus();
  const { devices, selectedDevice, connected: usbConnected, connectDevice, disconnectDevice, isSupported } = useWebUSB();

  const isConnected = wsConnected;

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'control', label: '打印控制', icon: Monitor },
    { id: 'gcode', label: 'G-code预览', icon: Layers },
    { id: 'printers', label: '多打印机', icon: Network },
    { id: 'detection', label: '故障检测', icon: Eye },
    { id: 'firmware', label: '固件升级', icon: Cpu },
    { id: 'history', label: '历史记录', icon: Printer },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                <Printer className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">3D Printer Control</h1>
                <p className="text-xs text-gray-500">Marlin Firmware Web Interface</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ConnectionPanel
                devices={devices}
                selectedDevice={selectedDevice}
                connected={usbConnected}
                isSupported={isSupported}
                onConnect={connectDevice}
                onDisconnect={disconnectDevice}
                onStartSimulation={startSimulation}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      activeTab === tab.id
                        ? 'text-primary-600 border-primary-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'control' && (
          <div className="space-y-6">
            <StatusPanel
              status={status}
              tempHistory={tempHistory}
              connected={isConnected}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ControlPanel
                status={status}
                connected={isConnected}
              />
              <VideoMonitor connected={isConnected} />
            </div>
          </div>
        )}

        {activeTab === 'gcode' && (
          <GCodePreview />
        )}

        {activeTab === 'printers' && (
          <MultiPrinterPanel />
        )}

        {activeTab === 'detection' && (
          <FailureDetection disabled={!isConnected} />
        )}

        {activeTab === 'firmware' && (
          <div className="max-w-2xl mx-auto">
            <FirmwareUpgrade disabled={!isConnected} />
          </div>
        )}

        {activeTab === 'history' && (
          <PrintHistory />
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                系统设置
              </h3>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">连接设置</h4>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">自动连接</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">WebSocket 地址</span>
                      <span className="text-sm text-gray-800 font-mono">ws://localhost:8080</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">显示设置</h4>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">温度单位</span>
                      <select className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        <option>°C (摄氏度)</option>
                        <option>°F (华氏度)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">温度历史长度</span>
                      <select className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        <option value="30">30 秒</option>
                        <option value="60">1 分钟</option>
                        <option value="300">5 分钟</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">关于</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">版本</span>
                      <span className="text-gray-800">2.0.0</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">后端服务</span>
                      <span className={cn(
                        'flex items-center gap-1.5',
                        isConnected ? 'text-green-600' : 'text-red-600'
                      )}>
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          isConnected ? 'bg-green-500' : 'bg-red-500'
                        )} />
                        {isConnected ? '已连接' : '未连接'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">WebUSB</span>
                      <span className={cn(
                        'flex items-center gap-1.5',
                        isSupported ? 'text-green-600' : 'text-yellow-600'
                      )}>
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          isSupported ? 'bg-green-500' : 'bg-yellow-500'
                        )} />
                        {isSupported ? '已支持' : '不支持'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">多打印机管理</span>
                      <span className="text-green-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        已启用
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">故障检测</span>
                      <span className="text-green-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        已启用
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>3D Printer Control System v2.0 © 2025</p>
            <p>Built with Go + React + TypeScript</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
