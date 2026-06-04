import React, { useState } from 'react';
import { useGamepad } from '../contexts/GamepadContext.jsx';

const ProfileManager = () => {
  const { profiles, activeProfileId, saveProfile, loadProfile, deleteProfile } = useGamepad();

  const [profileName, setProfileName] = useState('');
  const [gameName, setGameName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const profileList = Object.values(profiles).sort((a, b) => b.updatedAt - a.updatedAt);

  const handleSave = () => {
    if (!profileName.trim()) return;
    saveProfile(editingId, profileName, gameName);
    setProfileName('');
    setGameName('');
    setEditingId(null);
  };

  const handleEdit = (profile) => {
    setEditingId(profile.id);
    setProfileName(profile.name);
    setGameName(profile.gameName || '');
  };

  const handleCancel = () => {
    setEditingId(null);
    setProfileName('');
    setGameName('');
  };

  const formatDate = (ts) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">📁 配置文件</h1>
        <p className="text-gray-400">为不同游戏创建和切换独立的按键配置方案</p>
        {activeProfileId && profiles[activeProfileId] && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
            🎮 当前: {profiles[activeProfileId].name}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingId ? '编辑配置' : '创建新配置'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">配置名称</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="例如：FPS射击配置"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">绑定游戏（可选）</label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="例如：原神、艾尔登法环"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">📦 将保存当前设置：</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• 按键映射配置</li>
                  <li>• 宏定义</li>
                  <li>• 连发按钮设置</li>
                  <li>• 连发速度</li>
                  <li>• 震动模式</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!profileName.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingId ? '更新配置' : '保存配置'}
                </button>
                {editingId && (
                  <button
                    onClick={handleCancel}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                  >
                    取消
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-3">📖 使用说明</h3>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>• 配置文件保存当前所有按键映射和连发设置</li>
              <li>• 点击配置卡片上的「应用」快速切换配置</li>
              <li>• 每个配置可绑定一个游戏名称，方便识别</li>
              <li>• 配置保存在本地，登录后可同步到云端</li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              已保存的配置 ({profileList.length})
            </h2>

            {profileList.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-5xl mb-4">📁</div>
                <p className="text-lg">暂无配置文件</p>
                <p className="text-sm mt-1">创建一个配置来快速切换不同的游戏按键方案</p>
              </div>
            ) : (
              <div className="space-y-3">
                {profileList.map(profile => (
                  <div
                    key={profile.id}
                    className={`p-5 rounded-xl border-2 transition-all ${
                      activeProfileId === profile.id
                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/10'
                        : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-white font-semibold text-lg">{profile.name}</h3>
                          {activeProfileId === profile.id && (
                            <span className="px-2 py-0.5 bg-purple-500/30 text-purple-400 text-xs rounded-full">
                              当前
                            </span>
                          )}
                        </div>
                        
                        {profile.gameName && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-purple-400 text-sm">🎮 {profile.gameName}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-2 py-1 bg-slate-600/50 text-gray-400 rounded text-xs">
                            {Object.keys(profile.mappings || {}).length} 个映射
                          </span>
                          <span className="px-2 py-1 bg-slate-600/50 text-gray-400 rounded text-xs">
                            {(profile.macros || []).length} 个宏
                          </span>
                          <span className="px-2 py-1 bg-slate-600/50 text-gray-400 rounded text-xs">
                            {Object.keys(profile.turboButtons || {}).length} 个连发
                          </span>
                          <span className="px-2 py-1 bg-slate-600/50 text-gray-400 rounded text-xs">
                            {profile.turboRate || 10}次/秒
                          </span>
                        </div>

                        <div className="text-gray-500 text-xs">
                          创建: {formatDate(profile.createdAt)} · 更新: {formatDate(profile.updatedAt)}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {activeProfileId !== profile.id && (
                          <button
                            onClick={() => loadProfile(profile.id)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                          >
                            应用
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(profile)}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`确定要删除配置「${profile.name}」吗？`)) {
                              deleteProfile(profile.id);
                            }
                          }}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileManager;