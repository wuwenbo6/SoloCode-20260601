import React from 'react';
import { Link } from 'react-router-dom';
import { useGamepad } from '../contexts/GamepadContext.jsx';

const Dashboard = () => {
  const { selectedDevice, inputState, requestDevice, triggerRumble, turboButtons, profiles, activeProfileId } = useGamepad();

  const features = [
    {
      title: '输入监控',
      description: '实时查看手柄的摇杆和按键输入状态',
      icon: '🎮',
      path: '/monitor',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: '按键映射',
      description: '将手柄按钮映射到键盘按键或组合键',
      icon: '🔗',
      path: '/mapping',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: '连发设置',
      description: '为按钮开启连发模式，按住自动连续触发',
      icon: '⚡',
      path: '/turbo',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      title: '配置文件',
      description: '为不同游戏创建和快速切换配置方案',
      icon: '📁',
      path: '/profiles',
      color: 'from-indigo-500 to-blue-500'
    },
    {
      title: '宏编程',
      description: '录制和编辑复杂的操作序列宏',
      icon: '⏺️',
      path: '/macros',
      color: 'from-orange-500 to-red-500'
    },
    {
      title: '社区配置',
      description: '发现、分享和评价其他玩家的配置方案',
      icon: '🌍',
      path: '/community',
      color: 'from-teal-500 to-green-500'
    },
    {
      title: '云端同步',
      description: '将配置方案同步到云端，跨设备使用',
      icon: '☁️',
      path: '/sync',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">欢迎回来 👋</h1>
        <p className="text-gray-400">开始使用您的游戏手柄控制器</p>
      </div>

      <div className="mb-8 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">设备状态</h2>
          <button
            onClick={requestDevice}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            连接手柄
          </button>
        </div>

        {selectedDevice ? (
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">🎮</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">{selectedDevice.name}</h3>
              <p className="text-green-400 text-sm">● 已连接</p>
            </div>
            <button
              onClick={() => triggerRumble(1000, 0.3, 0.7)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              测试震动
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-500/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <div>
              <h3 className="text-gray-400 font-medium">未连接设备</h3>
              <p className="text-gray-500 text-sm">点击上方按钮连接您的游戏手柄</p>
            </div>
          </div>
        )}

        {selectedDevice && inputState.buttons.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">当前按键：</span>
              <div className="flex flex-wrap gap-1">
                {inputState.buttons.map((pressed, index) => (
                  pressed && (
                    <span
                      key={index}
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        turboButtons[index] 
                          ? 'bg-yellow-500/30 text-yellow-300' 
                          : 'bg-purple-500/30 text-purple-300'
                      }`}
                    >
                      B{index}{turboButtons[index] ? '⚡' : ''}
                    </span>
                  )
                ))}
                {inputState.buttons.every(b => !b) && (
                  <span className="text-gray-500 text-sm">无</span>
                )}
              </div>
            </div>
          </div>
        )}

        {(Object.keys(turboButtons).length > 0 || activeProfileId) && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-3">
            {Object.keys(turboButtons).length > 0 && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                ⚡ {Object.keys(turboButtons).length} 个连发按钮
              </span>
            )}
            {activeProfileId && profiles[activeProfileId] && (
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs">
                📁 {profiles[activeProfileId].name}
              </span>
            )}
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold text-white mb-4">功能模块</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((feature) => (
          <Link
            key={feature.path}
            to={feature.path}
            className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
          >
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <span className="text-2xl">{feature.icon}</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-gray-400 text-sm">{feature.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3">💡 使用提示</h3>
        <ul className="text-gray-400 text-sm space-y-2">
          <li>• 请使用 Chrome 或 Edge 浏览器以获得最佳 WebHID 支持</li>
          <li>• 连接手柄后，您可以在「输入监控」中查看实时输入数据</li>
          <li>• 在「按键映射」中配置手柄按钮对应的键盘按键</li>
          <li>• 登录后可将配置同步到云端，在任意设备上使用</li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;