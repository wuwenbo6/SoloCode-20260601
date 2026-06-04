import React, { useState, useEffect } from 'react';
import { useGamepad } from '../contexts/GamepadContext.jsx';
import axios from 'axios';

const MacroEditor = () => {
  const { 
    isRecording, 
    recordedMacro, 
    startRecording, 
    stopRecording, 
    clearRecording, 
    setRecordedMacro,
    isPlayingMacro,
    playMacro,
    stopMacroPlayback
  } = useGamepad();
  
  const [macros, setMacros] = useState([]);
  const [macroName, setMacroName] = useState('');
  const [selectedMacro, setSelectedMacro] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMacros();
  }, []);

  const loadMacros = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/macros');
      setMacros(response.data);
    } catch (error) {
      console.error('加载宏失败:', error);
      const localMacros = localStorage.getItem('localMacros');
      if (localMacros) {
        setMacros(JSON.parse(localMacros));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveMacro = async () => {
    if (!macroName.trim() || recordedMacro.length === 0) {
      alert('请输入宏名称并录制操作序列');
      return;
    }

    try {
      const response = await axios.post('/api/macros', {
        name: macroName,
        macro_data: recordedMacro
      });
      
      const newMacro = {
        id: response.data.id,
        name: macroName,
        macro_data: recordedMacro
      };
      
      setMacros(prev => [...prev, newMacro]);
      saveToLocal([...macros, newMacro]);
      setMacroName('');
      clearRecording();
      alert('宏保存成功！');
    } catch (error) {
      console.error('保存宏失败:', error);
      const newMacro = {
        id: Date.now(),
        name: macroName,
        macro_data: recordedMacro
      };
      const updated = [...macros, newMacro];
      setMacros(updated);
      saveToLocal(updated);
      setMacroName('');
      clearRecording();
      alert('已保存到本地（离线模式）');
    }
  };

  const saveToLocal = (macroList) => {
    localStorage.setItem('localMacros', JSON.stringify(macroList));
  };

  const deleteMacro = async (id) => {
    if (!confirm('确定要删除这个宏吗？')) return;

    try {
      await axios.delete(`/api/macros/${id}`);
      const updated = macros.filter(m => m.id !== id);
      setMacros(updated);
      saveToLocal(updated);
    } catch (error) {
      const updated = macros.filter(m => m.id !== id);
      setMacros(updated);
      saveToLocal(updated);
    }
  };

  const loadMacro = (macro) => {
    if (isPlayingMacro) return;
    setSelectedMacro(macro);
    if (macro.macro_data) {
      setRecordedMacro(macro.macro_data);
    }
  };

  const handlePlayMacro = async (macro) => {
    if (isPlayingMacro) {
      stopMacroPlayback();
      return;
    }
    
    const data = macro.macro_data || recordedMacro;
    await playMacro(data);
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getTotalDuration = (steps) => {
    return steps
      .filter(s => s.type === 'delay')
      .reduce((acc, s) => acc + s.duration, 0);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">⏺️ 宏编程</h1>
        <p className="text-gray-400">录制、编辑和管理操作序列宏</p>
        {isPlayingMacro && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            宏播放中 - 输入已锁定
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">录制宏</h2>
            
            <div className="flex gap-3 mb-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isPlayingMacro}
                  className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                  开始录制
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  停止录制
                </button>
              )}
              <button
                onClick={clearRecording}
                disabled={isPlayingMacro}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                清空
              </button>
            </div>

            {isRecording && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-center mb-4">
                <div className="text-red-400 font-medium flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  正在录制中...
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  按下手柄按钮来记录操作
                </div>
              </div>
            )}

            {isPlayingMacro && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-blue-400 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    宏播放中 - 输入已锁定
                  </div>
                  <button
                    onClick={stopMacroPlayback}
                    className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
                  >
                    停止
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">宏名称</label>
              <input
                type="text"
                value={macroName}
                onChange={(e) => setMacroName(e.target.value)}
                placeholder="输入宏名称..."
                disabled={isPlayingMacro}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            <button
              onClick={saveMacro}
              disabled={recordedMacro.length === 0 || !macroName.trim() || isPlayingMacro}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存宏
            </button>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  录制的操作 ({recordedMacro.length} 步)
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  总时长: {formatDuration(getTotalDuration(recordedMacro))}
                </p>
              </div>
              {recordedMacro.length > 0 && (
                <button
                  onClick={() => handlePlayMacro({ macro_data: recordedMacro })}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isPlayingMacro ? (
                    <>
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      停止
                    </>
                  ) : (
                    <>▶️ 播放</>
                  )}
                </button>
              )}
            </div>
            
            <div className="max-h-80 overflow-y-auto space-y-2">
              {recordedMacro.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📹</div>
                  <p>开始录制以捕获操作序列</p>
                </div>
              ) : (
                recordedMacro.map((step, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      step.type === 'delay'
                        ? 'bg-yellow-500/20 border border-yellow-500/30'
                        : 'bg-purple-500/20 border border-purple-500/30'
                    }`}
                  >
                    {step.type === 'delay' ? (
                      <span className="text-yellow-400">
                        ⏱️ 延迟 {formatDuration(step.duration)}
                      </span>
                    ) : (
                      <div>
                        <span className="text-purple-400">🎮 输入</span>
                        <div className="text-gray-400 text-xs mt-1">
                          按钮: {step.buttons.filter(Boolean).length > 0 
                            ? step.buttons.map((b, i) => b ? `B${i}` : null).filter(Boolean).join(', ')
                            : '无'
                          }
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">已保存的宏</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : macros.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📁</div>
              <p>暂无保存的宏</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {macros.map((macro) => (
                <div
                  key={macro.id}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    selectedMacro?.id === macro.id
                      ? 'bg-purple-600/30 border-purple-500'
                      : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                  } ${isPlayingMacro ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => loadMacro(macro)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">{macro.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {macro.macro_data?.length || 0} 步操作 · 
                        {formatDuration(getTotalDuration(macro.macro_data || []))}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayMacro(macro);
                        }}
                        className="p-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors"
                        title={isPlayingMacro ? '停止' : '播放'}
                      >
                        {isPlayingMacro ? '⏹️' : '▶️'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMacro(macro.id);
                        }}
                        className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3">📖 宏编程说明</h3>
        <ul className="text-gray-400 text-sm space-y-2">
          <li>• <span className="text-purple-400">互斥锁机制</span>：宏播放时会自动锁定手动输入，防止重复触发</li>
          <li>• 点击「开始录制」后，操作手柄按钮和摇杆来录制操作序列</li>
          <li>• 系统会自动记录操作之间的时间间隔</li>
          <li>• 保存的宏可以在任意时候加载并播放</li>
          <li>• 播放中的宏可以随时点击停止按钮中断</li>
        </ul>
      </div>
    </div>
  );
};

export default MacroEditor;
