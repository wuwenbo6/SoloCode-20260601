import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SyncSettings = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [configName, setConfigName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/configs');
      setConfigs(response.data);
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const uploadConfig = async () => {
    if (!configName.trim()) {
      showMessage('请输入配置名称', 'error');
      return;
    }

    const buttonMappings = JSON.parse(localStorage.getItem('buttonMappings') || '{}');
    const localMacros = JSON.parse(localStorage.getItem('localMacros') || '[]');

    const configData = {
      buttonMappings,
      macros: localMacros,
      timestamp: Date.now()
    };

    try {
      setSyncing(true);
      await axios.post('/api/configs', {
        name: configName,
        config_data: configData,
        is_default: isDefault
      });
      
      await loadConfigs();
      setConfigName('');
      setIsDefault(false);
      showMessage('配置上传成功！');
    } catch (error) {
      showMessage('上传失败: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const downloadConfig = async (config) => {
    try {
      setSyncing(true);
      const response = await axios.get(`/api/configs/${config.id}`);
      const configData = response.data.config_data;

      if (configData.buttonMappings) {
        localStorage.setItem('buttonMappings', JSON.stringify(configData.buttonMappings));
      }
      if (configData.macros) {
        localStorage.setItem('localMacros', JSON.stringify(configData.macros));
      }

      showMessage(`配置「${config.name}」已下载并应用！`);
    } catch (error) {
      showMessage('下载失败', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const setDefaultConfig = async (config) => {
    try {
      await axios.put(`/api/configs/${config.id}`, {
        name: config.name,
        config_data: {},
        is_default: true
      });
      await loadConfigs();
      showMessage('已设为默认配置');
    } catch (error) {
      showMessage('操作失败', 'error');
    }
  };

  const deleteConfig = async (id) => {
    if (!confirm('确定要删除这个配置吗？')) return;

    try {
      await axios.delete(`/api/configs/${id}`);
      await loadConfigs();
      showMessage('配置已删除');
    } catch (error) {
      showMessage('删除失败', 'error');
    }
  };

  const syncDefaultConfig = async () => {
    try {
      setSyncing(true);
      const response = await axios.get('/api/configs/sync/default');
      const configData = response.data.config_data;

      if (configData.buttonMappings) {
        localStorage.setItem('buttonMappings', JSON.stringify(configData.buttonMappings));
      }
      if (configData.macros) {
        localStorage.setItem('localMacros', JSON.stringify(configData.macros));
      }

      showMessage('默认配置同步成功！');
    } catch (error) {
      showMessage('没有找到默认配置', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">☁️ 云端同步</h1>
        <p className="text-gray-400">将您的配置方案同步到云端</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-500/20 border border-green-500/50 text-green-400' 
            : 'bg-red-500/20 border border-red-500/50 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">上传配置</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">配置名称</label>
                <input
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="例如：我的游戏配置"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-gray-300">设为默认配置</span>
              </label>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-sm text-gray-400">
                  <div className="mb-2">📦 将要上传的数据：</div>
                  <div className="space-y-1 text-xs">
                    <div>• 按键映射: {Object.keys(JSON.parse(localStorage.getItem('buttonMappings') || '{}')).length} 个</div>
                    <div>• 宏: {JSON.parse(localStorage.getItem('localMacros') || '[]').length} 个</div>
                  </div>
                </div>
              </div>

              <button
                onClick={uploadConfig}
                disabled={syncing || !configName.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? '上传中...' : '📤 上传配置'}
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">快速同步</h2>
            <p className="text-gray-400 text-sm mb-4">
              一键下载并应用默认配置到本地
            </p>
            <button
              onClick={syncDefaultConfig}
              disabled={syncing}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? '同步中...' : '📥 同步默认配置'}
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">云端配置列表</h2>
            <button
              onClick={loadConfigs}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              🔄 刷新
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📁</div>
              <p>暂无云端配置</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`p-4 rounded-lg border transition-all ${
                    config.is_default
                      ? 'bg-green-500/10 border-green-500/50'
                      : 'bg-slate-700/50 border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{config.name}</span>
                      {config.is_default && (
                        <span className="px-2 py-0.5 bg-green-500/30 text-green-400 text-xs rounded-full">
                          默认
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-400 text-xs mb-3">
                    更新于 {formatDate(config.updated_at || config.created_at)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadConfig(config)}
                      disabled={syncing}
                      className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      下载应用
                    </button>
                    {!config.is_default && (
                      <button
                        onClick={() => setDefaultConfig(config)}
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      onClick={() => deleteConfig(config.id)}
                      className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3">📖 同步说明</h3>
        <ul className="text-gray-400 text-sm space-y-2">
          <li>• 配置数据包括：按键映射、宏定义</li>
          <li>• 数据安全存储在服务器端，与您的账号绑定</li>
          <li>• 设为默认配置后，可以在任意设备上快速同步</li>
          <li>• 下载配置会覆盖当前本地配置，请谨慎操作</li>
        </ul>
      </div>
    </div>
  );
};

export default SyncSettings;