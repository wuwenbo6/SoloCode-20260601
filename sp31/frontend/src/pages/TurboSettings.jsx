import React from 'react';
import { useGamepad } from '../contexts/GamepadContext.jsx';

const TurboSettings = () => {
  const {
    inputState,
    turboButtons,
    turboRate,
    toggleTurbo,
    updateTurboRate,
    selectedDevice
  } = useGamepad();

  const buttonNames = [
    'A', 'B', 'X', 'Y',
    'LB', 'RB', 'LT', 'RT',
    'Back', 'Start', 'L3', 'R3',
    'Guide', 'D1', 'D2', 'D3',
    'D-Up', 'D-Down', 'D-Left', 'D-Right'
  ];

  const turboRateOptions = [
    { value: 5, label: '5次/秒 (慢速)' },
    { value: 10, label: '10次/秒 (标准)' },
    { value: 15, label: '15次/秒 (快速)' },
    { value: 20, label: '20次/秒 (极速)' }
  ];

  const activeTurboCount = Object.keys(turboButtons).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">⚡ 连发设置</h1>
        <p className="text-gray-400">为手柄按钮开启连发模式，按住时自动连续触发</p>
        {activeTurboCount > 0 && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
            ⚡ {activeTurboCount} 个按钮已启用连发
          </div>
        )}
      </div>

      <div className="mb-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">连发速度</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {turboRateOptions.map(option => (
            <button
              key={option.value}
              onClick={() => updateTurboRate(option.value)}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                turboRate === option.value
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700 border border-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-4 bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">当前连发速度</span>
            <span className="text-purple-400 font-mono">{turboRate} 次/秒</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-400">每次触发间隔</span>
            <span className="text-purple-400 font-mono">{(1000 / turboRate).toFixed(0)} ms</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">按钮连发开关</h2>
          <button
            onClick={() => {
              if (activeTurboCount > 0) {
                Object.keys(turboButtons).forEach(key => toggleTurbo(parseInt(key)));
              }
            }}
            className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
            disabled={activeTurboCount === 0}
          >
            全部关闭
          </button>
        </div>

        {!selectedDevice ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🎮</div>
            <p>请先连接手柄以查看按钮状态</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {buttonNames.map((name, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  turboButtons[index]
                    ? 'bg-yellow-500/20 border-yellow-500'
                    : inputState.buttons[index]
                      ? 'bg-green-500/10 border-green-500/50'
                      : 'bg-slate-700/50 border-slate-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                    turboButtons[index]
                      ? 'bg-yellow-500 text-black'
                      : inputState.buttons[index]
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-600 text-gray-300'
                  }`}>
                    {name}
                  </span>
                  <div>
                    <div className="text-white text-sm font-medium">按钮 {index}</div>
                    <div className="text-xs">
                      {turboButtons[index] ? (
                        <span className="text-yellow-400">⚡ 连发 {turboRate}次/秒</span>
                      ) : inputState.buttons[index] ? (
                        <span className="text-green-400">● 按下中</span>
                      ) : (
                        <span className="text-gray-500">未启用</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleTurbo(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    turboButtons[index]
                      ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                      : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                  }`}
                >
                  {turboButtons[index] ? '⚡ 连发中' : '开启连发'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3">📖 连发说明</h3>
        <ul className="text-gray-400 text-sm space-y-2">
          <li>• <span className="text-yellow-400">连发模式</span>：开启后，按住该按钮时将以设定频率自动连续触发</li>
          <li>• 标准连发速度为 10次/秒，适用于大多数格斗/射击游戏</li>
          <li>• 连发设置会随配置文件一起保存</li>
          <li>• 连发触发时不会与宏播放冲突（互斥锁保护）</li>
        </ul>
      </div>
    </div>
  );
};

export default TurboSettings;