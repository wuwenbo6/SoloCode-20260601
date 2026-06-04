import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';

export const VSTPanel: React.FC = () => {
  const { state, dispatch, connectVST, disconnectVST, loadVSTPlugin, unloadVSTPlugin, updateVSTParameter } = useStudio();
  const [vstHost, setVstHost] = useState('ws://localhost:8080');
  const [isConnecting, setIsConnecting] = useState(false);

  if (!state.showVSTPanel) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectVST(vstHost);
    } catch (error) {
      alert('连接 VST 宿主失败: ' + (error as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectVST();
  };

  const handleLoadPlugin = async (pluginName: string) => {
    if (!state.selectedTrackId) {
      alert('请先选择一个轨道');
      return;
    }

    try {
      await loadVSTPlugin(state.selectedTrackId, pluginName);
    } catch (error) {
      alert('加载插件失败: ' + (error as Error).message);
    }
  };

  const selectedTrack = state.project.tracks.find(t => t.id === state.selectedTrackId);

  return (
    <div className="modal-overlay" onClick={() => dispatch({ type: 'SET_VST_PANEL', payload: false })}>
      <div className="modal vst-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>VST 插件桥接</h2>
          <button
            className="btn-close"
            onClick={() => dispatch({ type: 'SET_VST_PANEL', payload: false })}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="vst-section">
            <h4>连接 VST 宿主</h4>
            <div className="vst-connection">
              <input
                type="text"
                value={vstHost}
                onChange={(e) => setVstHost(e.target.value)}
                placeholder="ws://localhost:8080"
                className="input-medium"
                disabled={state.vstConnected || isConnecting}
              />
              {state.vstConnected ? (
                <button className="btn btn-danger" onClick={handleDisconnect}>
                  断开
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? '连接中...' : '连接'}
                </button>
              )}
              <span className={`connection-status ${state.vstConnected ? 'connected' : 'disconnected'}`}>
                {state.vstConnected ? '已连接' : '未连接'}
              </span>
            </div>
          </div>

          {state.vstConnected && (
            <>
              <div className="vst-section">
                <h4>可用插件</h4>
                {state.availableVSTPlugins.length === 0 ? (
                  <p className="text-muted">没有检测到可用的 VST 插件</p>
                ) : (
                  <div className="vst-plugin-list">
                    {state.availableVSTPlugins.map((pluginName, index) => (
                      <div key={index} className="vst-plugin-item">
                        <span>{pluginName}</span>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => handleLoadPlugin(pluginName)}
                          disabled={!state.selectedTrackId}
                        >
                          加载到当前轨道
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="vst-section">
                <h4>当前轨道插件</h4>
                {selectedTrack?.vst ? (
                  <div className="vst-loaded-plugin">
                    <div className="vst-plugin-header">
                      <span className="vst-plugin-name">{selectedTrack.vst.name}</span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={selectedTrack.vst.enabled}
                          onChange={(e) => dispatch({
                            type: 'UPDATE_TRACK',
                            payload: {
                              trackId: state.selectedTrackId!,
                              updates: { vst: { ...selectedTrack.vst!, enabled: e.target.checked } }
                            }
                          })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                    {selectedTrack.vst.parameters.length > 0 ? (
                      <div className="vst-parameters">
                        {selectedTrack.vst.parameters.map(param => (
                          <div key={param.id} className="vst-param">
                            <label>{param.name}</label>
                            <input
                              type="range"
                              min={param.min}
                              max={param.max}
                              step={0.01}
                              value={param.value}
                              onChange={(e) => updateVSTParameter(
                                selectedTrack.vst!.id,
                                param.id,
                                Number(e.target.value)
                              )}
                            />
                            <span className="param-value">{param.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">暂无参数</p>
                    )}

                    <button
                      className="btn btn-small btn-danger mt-8"
                      onClick={() => unloadVSTPlugin(selectedTrack.vst!.id)}
                    >
                      卸载插件
                    </button>
                  </div>
                ) : (
                  <p className="text-muted">当前轨道没有加载插件</p>
                )}
              </div>
            </>
          )}

          {!state.vstConnected && (
            <div className="vst-help">
              <h4>如何使用 VST 桥接</h4>
              <ol>
                <li>启动 VST 宿主应用（如 element、carla 等）</li>
                <li>在宿主中启用 WebSocket 服务器，监听 8080 端口</li>
                <li>点击"连接"按钮连接到宿主</li>
                <li>选择一个轨道，然后加载 VST 插件</li>
                <li>现在播放 MIDI 音符将通过 VST 插件处理</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
