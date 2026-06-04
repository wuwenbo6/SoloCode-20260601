import React, { useState, useEffect } from 'react';
import { useGamepad } from '../contexts/GamepadContext.jsx';

const MappingConfig = () => {
  const { inputState, selectedDevice } = useGamepad();
  const [mappings, setMappings] = useState(() => {
    const saved = localStorage.getItem('buttonMappings');
    return saved ? JSON.parse(saved) : {};
  });
  const [editingButton, setEditingButton] = useState(null);
  const [recordedKey, setRecordedKey] = useState(null);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [mappingType, setMappingType] = useState('key');

  const buttonNames = [
    'A', 'B', 'X', 'Y',
    'LB', 'RB', 'LT', 'RT',
    'Back', 'Start', 'L3', 'R3',
    'Guide', 'D1', 'D2', 'D3',
    'D-Up', 'D-Down', 'D-Left', 'D-Right'
  ];

  const keyNames = {
    ' ': 'Space',
    'Enter': 'Enter',
    'Escape': 'Esc',
    'Tab': 'Tab',
    'Backspace': 'Backspace',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Control': 'Ctrl',
    'Shift': 'Shift',
    'Alt': 'Alt',
    'Meta': 'Win'
  };

  useEffect(() => {
    localStorage.setItem('buttonMappings', JSON.stringify(mappings));
  }, [mappings]);

  useEffect(() => {
    if (!isRecordingKey) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      const keys = [];
      if (e.ctrlKey) keys.push('Control');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');
      if (e.metaKey) keys.push('Meta');
      
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        keys.push(e.key);
      }

      if (keys.length > 0) {
        setRecordedKey(keys);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordingKey]);

  const startRecording = (buttonIndex) => {
    setEditingButton(buttonIndex);
    setIsRecordingKey(true);
    setRecordedKey(null);
  };

  const saveMapping = () => {
    if (editingButton !== null && recordedKey) {
      setMappings(prev => ({
        ...prev,
        [editingButton]: {
          type: mappingType,
          value: recordedKey
        }
      }));
    }
    setEditingButton(null);
    setIsRecordingKey(false);
    setRecordedKey(null);
  };

  const cancelEditing = () => {
    setEditingButton(null);
    setIsRecordingKey(false);
    setRecordedKey(null);
  };

  const clearMapping = (buttonIndex) => {
    setMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[buttonIndex];
      return newMappings;
    });
  };

  const formatKeyDisplay = (keys) => {
    if (!keys || keys.length === 0) return '未设置';
    return keys.map(k => keyNames[k] || k.toUpperCase()).join(' + ');
  };

  const executeKeyPress = async (mapping) => {
    if (!mapping || mapping.type !== 'key') return;

    const keys = mapping.value;
    const keyEvent = {
      ctrlKey: keys.includes('Control'),
      shiftKey: keys.includes('Shift'),
      altKey: keys.includes('Alt'),
      metaKey: keys.includes('Meta'),
      key: keys.find(k => !['Control', 'Shift', 'Alt', 'Meta'].includes(k))
    };

    console.log('模拟按键:', keyEvent);
    alert(`模拟按键: ${formatKeyDisplay(keys)}`);
  };

  useEffect(() => {
    if (!selectedDevice) return;

    inputState.buttons.forEach((pressed, index) => {
      if (pressed && mappings[index]) {
        executeKeyPress(mappings[index]);
      }
    });
  }, [inputState.buttons]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🔗 按键映射</h1>
        <p className="text-gray-400">将手柄按钮映射到键盘按键或组合键</p>
      </div>

      {isRecordingKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">
              录制按键
            </h3>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 animate-pulse">⌨️</div>
              <p className="text-gray-400">按下您想要映射的按键（支持组合键）</p>
            </div>
            {recordedKey && (
              <div className="bg-slate-700/50 rounded-lg p-4 text-center mb-6">
                <div className="text-gray-400 text-sm mb-2">已录制：</div>
                <div className="text-2xl font-mono text-purple-400">
                  {formatKeyDisplay(recordedKey)}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={cancelEditing}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveMapping}
                disabled={!recordedKey}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">按钮映射列表</h2>
          <button
            onClick={() => {
              if (confirm('确定要清除所有映射吗？')) {
                setMappings({});
              }
            }}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            清除全部
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {buttonNames.map((name, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                inputState.buttons[index]
                  ? 'bg-green-500/20 border-2 border-green-500'
                  : 'bg-slate-700/50 border-2 border-slate-600'
              } ${editingButton === index ? 'ring-2 ring-purple-500' : ''}`}
            >
              <div className="flex items-center space-x-3">
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                  inputState.buttons[index]
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-gray-300'
                }`}>
                  {name}
                </span>
                <div>
                  <div className="text-white text-sm font-medium">按钮 {index}</div>
                  <div className="text-xs text-gray-400">
                    {mappings[index] ? (
                      <span className="text-purple-400">
                        {formatKeyDisplay(mappings[index].value)}
                      </span>
                    ) : (
                      '未映射'
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startRecording(index)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                >
                  {mappings[index] ? '编辑' : '映射'}
                </button>
                {mappings[index] && (
                  <button
                    onClick={() => clearMapping(index)}
                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3">📖 使用说明</h3>
        <ul className="text-gray-400 text-sm space-y-2">
          <li>• 点击「映射」按钮开始录制键盘按键</li>
          <li>• 支持录制组合键（如 Ctrl+C、Shift+Alt+A）</li>
          <li>• 映射会自动保存到本地存储</li>
          <li>• 登录后可在「云端同步」中上传到服务器</li>
        </ul>
      </div>
    </div>
  );
};

export default MappingConfig;