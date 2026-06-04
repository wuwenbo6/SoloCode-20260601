import React, { useState } from 'react';
import { useGamepad } from '../contexts/GamepadContext.jsx';

const GamepadMonitor = () => {
  const {
    devices,
    selectedDevice,
    inputState,
    requestDevice,
    disconnectDevice,
    setSelectedDevice,
    triggerRumble,
    rumbleMode,
    setRumbleMode,
    rumbleAvailable,
    descriptorInfo
  } = useGamepad();

  const [rumbleDuration, setRumbleDuration] = useState(500);
  const [weakMagnitude, setWeakMagnitude] = useState(0.5);
  const [strongMagnitude, setStrongMagnitude] = useState(0.5);
  const [showDescriptor, setShowDescriptor] = useState(false);

  const buttonNames = [
    'A', 'B', 'X', 'Y',
    'LB', 'RB', 'LT', 'RT',
    'Back', 'Start', 'L3', 'R3',
    'Guide', 'D1', 'D2', 'D3',
    'D-Up', 'D-Down', 'D-Left', 'D-Right'
  ];

  const axisNames = ['LX', 'LY', 'RX', 'RY'];

  const rumbleModes = [
    { value: 'auto', label: '自动（推荐）' },
    { value: 'xbox', label: 'Xbox 模式' },
    { value: 'ds4', label: 'PS4/DS4 模式' },
    { value: 'generic', label: '通用模式' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🎮 输入监控</h1>
        <p className="text-gray-400">实时查看手柄输入状态和原始数据</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">设备列表</h2>
            
            <button
              onClick={requestDevice}
              className="w-full mb-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200"
            >
              + 连接新设备
            </button>

            <div className="space-y-2">
              {devices.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">🔌</div>
                  <p>暂无连接的设备</p>
                </div>
              ) : (
                devices.map((device, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedDevice?.device === device.device
                        ? 'bg-purple-600/30 border border-purple-500'
                        : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700'
                    }`}
                    onClick={() => setSelectedDevice(device)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🎮</span>
                        <div>
                          <p className="text-white font-medium text-sm">{device.name}</p>
                          <p className="text-gray-400 text-xs">
                            VID: {device.vendorId.toString(16).padStart(4, '0')} | 
                            PID: {device.productId.toString(16).padStart(4, '0')}
                          </p>
                          {device.hasRumble && (
                            <p className="text-green-400 text-xs">✓ 支持震动</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          disconnectDevice(device.device);
                        }}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedDevice && (
            <>
              <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">📳 震动控制</h2>
                  {rumbleAvailable ? (
                    <span className="text-green-400 text-xs">✓ 可用</span>
                  ) : (
                    <span className="text-yellow-400 text-xs">⚠ 未检测到</span>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">震动模式</label>
                    <select
                      value={rumbleMode}
                      onChange={(e) => setRumbleMode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {rumbleModes.map(mode => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-gray-500 text-xs mt-1">
                      自动模式会依次尝试不同协议
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      持续时间: {rumbleDuration}ms
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="3000"
                      step="100"
                      value={rumbleDuration}
                      onChange={(e) => setRumbleDuration(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      弱马达强度: {(weakMagnitude * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={weakMagnitude}
                      onChange={(e) => setWeakMagnitude(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      强马达强度: {(strongMagnitude * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={strongMagnitude}
                      onChange={(e) => setStrongMagnitude(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => triggerRumble(rumbleDuration, weakMagnitude, strongMagnitude)}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-lg transition-all duration-200"
                  >
                    触发震动
                  </button>
                </div>
              </div>

              {descriptorInfo && (
                <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setShowDescriptor(!showDescriptor)}
                  >
                    <h2 className="text-lg font-semibold text-white">📋 设备描述符</h2>
                    <span className="text-gray-400">{showDescriptor ? '▼' : '▶'}</span>
                  </div>
                  
                  {showDescriptor && (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">设备名称</span>
                        <span className="text-white">{descriptorInfo.productName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Vendor ID</span>
                        <span className="text-white font-mono">0x{descriptorInfo.vendorId.toString(16).padStart(4, '0')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Product ID</span>
                        <span className="text-white font-mono">0x{descriptorInfo.productId.toString(16).padStart(4, '0')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">设备类型</span>
                        <span className="text-purple-400">{descriptorInfo.deviceType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">报告数量</span>
                        <span className="text-white">{descriptorInfo.reports?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">集合数量</span>
                        <span className="text-white">{descriptorInfo.collections?.length || 0}</span>
                      </div>
                      
                      {descriptorInfo.reports && descriptorInfo.reports.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-600">
                          <p className="text-gray-400 mb-2">报告详情：</p>
                          <div className="bg-slate-900 rounded p-3 max-h-40 overflow-y-auto">
                            {descriptorInfo.reports.map((report, idx) => (
                              <div key={idx} className="text-xs text-gray-300 mb-1">
                                <span className="text-purple-400">[{report.reportId || 0}]</span>
                                {' '}{report.type || 'unknown'}
                                {' '}{report.items?.length || 0} items
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedDevice ? (
            <div className="space-y-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">摇杆 (Axes)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {inputState.axes.map((value, index) => (
                    <div key={index} className="text-center">
                      <div className="text-gray-400 text-sm mb-2">{axisNames[index] || `Axis ${index}`}</div>
                      <div className="relative w-full h-8 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-75"
                          style={{
                            left: '50%',
                            width: `${Math.abs(value) * 50}%`,
                            transform: value >= 0 ? 'translateX(0)' : 'translateX(-100%)'
                          }}
                        />
                        <div className="absolute top-1/2 left-1/2 w-1 h-full bg-slate-500 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div className="text-white text-sm mt-1 font-mono">
                        {value !== undefined ? value.toFixed(3) : '---'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  {['Left Stick', 'Right Stick'].map((stick, index) => (
                    <div key={stick} className="flex flex-col items-center">
                      <div className="text-gray-400 text-sm mb-2">{stick}</div>
                      <div className="relative w-32 h-32 bg-slate-700 rounded-full border-2 border-slate-600">
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-600" />
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
                        <div
                          className="absolute w-6 h-6 bg-purple-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-purple-500/50 transition-all duration-75"
                          style={{
                            left: `${50 + (inputState.axes[index * 2] || 0) * 40}%`,
                            top: `${50 + (inputState.axes[index * 2 + 1] || 0) * 40}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {inputState.hats && inputState.hats.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h2 className="text-lg font-semibold text-white mb-4">方向键 (Hat Switch)</h2>
                  <div className="flex gap-4">
                    {inputState.hats.map((hat, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <div className="relative w-20 h-20">
                          <div className="absolute inset-0 bg-slate-700 rounded-lg" />
                          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded ${
                            hat === 0 || hat === 1 || hat === 7 ? 'bg-purple-500' : 'bg-slate-600'
                          }`} />
                          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded ${
                            hat === 1 || hat === 2 || hat === 3 ? 'bg-purple-500' : 'bg-slate-600'
                          }`} />
                          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded ${
                            hat === 3 || hat === 4 || hat === 5 ? 'bg-purple-500' : 'bg-slate-600'
                          }`} />
                          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded ${
                            hat === 5 || hat === 6 || hat === 7 ? 'bg-purple-500' : 'bg-slate-600'
                          }`} />
                        </div>
                        <div className="text-gray-400 text-sm">
                          值: {hat}
                          <br />
                          <span className="text-purple-400">
                            {hat === 15 ? '居中' : 
                             hat === 0 ? '上' :
                             hat === 1 ? '右上' :
                             hat === 2 ? '右' :
                             hat === 3 ? '右下' :
                             hat === 4 ? '下' :
                             hat === 5 ? '左下' :
                             hat === 6 ? '左' :
                             hat === 7 ? '左上' : '未知'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">按钮 (Buttons) - {inputState.buttons.filter(b => b).length} 按下</h2>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                  {Array.from({ length: 20 }).map((_, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg text-center transition-all duration-100 ${
                        inputState.buttons[index]
                          ? 'bg-green-500/30 border-2 border-green-500 shadow-lg shadow-green-500/30'
                          : 'bg-slate-700/50 border-2 border-slate-600'
                      }`}
                    >
                      <div className={`text-sm font-bold ${
                        inputState.buttons[index] ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {buttonNames[index] || `B${index}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">原始数据 (Raw Data) - {inputState.rawData?.length || 0} bytes</h2>
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-gray-400 mb-2">Report ID: {inputState.reportId ?? 'N/A'}</div>
                  <div className="flex flex-wrap gap-2">
                    {inputState.rawData ? (
                      inputState.rawData.map((byte, index) => (
                        <span
                          key={index}
                          className={`px-2 py-1 rounded ${
                            byte !== 0
                              ? 'bg-purple-500/30 text-purple-300'
                              : 'bg-slate-800 text-gray-500'
                          }`}
                        >
                          {byte.toString(16).padStart(2, '0').toUpperCase()}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500">等待输入...</span>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="text-gray-500 text-xs">
                      二进制: {inputState.rawData?.map(b => b.toString(2).padStart(8, '0')).join(' ') || '...'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 border border-slate-700 text-center">
              <div className="text-6xl mb-4">🎮</div>
              <h2 className="text-xl font-semibold text-white mb-2">请选择一个设备</h2>
              <p className="text-gray-400">连接并选择一个游戏手柄以查看实时输入</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GamepadMonitor;
