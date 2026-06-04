import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.jsx';

const CommunityHub = () => {
  const { isAuthenticated } = useAuth();
  const [configs, setConfigs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', game_name: '', description: '' });
  const [userRating, setUserRating] = useState(0);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, [page, sort]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/community', {
        params: { sort, search, page, limit: 12 }
      });
      setConfigs(response.data.configs);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('加载社区配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadConfigs();
  };

  const downloadConfig = async (config) => {
    try {
      const response = await axios.get(`/api/community/${config.id}`);
      const configData = response.data.config_data;

      if (configData.buttonMappings) {
        localStorage.setItem('buttonMappings', JSON.stringify(configData.buttonMappings));
      }
      if (configData.macros) {
        localStorage.setItem('localMacros', JSON.stringify(configData.macros));
      }

      await axios.post(`/api/community/${config.id}/download`);
      loadConfigs();

      showMessage(`配置「${config.name}」已下载并应用！`);
    } catch (error) {
      showMessage('下载失败', 'error');
    }
  };

  const uploadConfig = async () => {
    if (!uploadForm.name.trim()) {
      showMessage('请输入配置名称', 'error');
      return;
    }

    try {
      const buttonMappings = JSON.parse(localStorage.getItem('buttonMappings') || '{}');
      const localMacros = JSON.parse(localStorage.getItem('localMacros') || '[]');

      await axios.post('/api/community', {
        name: uploadForm.name,
        game_name: uploadForm.game_name,
        description: uploadForm.description,
        config_data: { buttonMappings, macros: localMacros }
      });

      setShowUpload(false);
      setUploadForm({ name: '', game_name: '', description: '' });
      loadConfigs();
      showMessage('配置已分享到社区！');
    } catch (error) {
      showMessage('上传失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const rateConfig = async (configId, rating) => {
    try {
      await axios.post(`/api/community/${configId}/rate`, { rating });
      setUserRating(rating);
      loadConfigs();
      showMessage('评分成功！');
    } catch (error) {
      showMessage('评分失败', 'error');
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStars = (avgRating, count) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            className={`text-sm ${star <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-600'}`}
          >
            ★
          </span>
        ))}
        <span className="text-gray-400 text-xs ml-1">
          {avgRating > 0 ? avgRating.toFixed(1) : '暂无'} ({count})
        </span>
      </div>
    );
  };

  const renderRatingInput = (configId) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => rateConfig(configId, star)}
            className={`text-lg transition-colors ${
              star <= userRating ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'
            }`}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🌍 社区配置</h1>
        <p className="text-gray-400">发现、分享和评价其他玩家的手柄配置方案</p>
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

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索配置名称或游戏..."
            className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            搜索
          </button>
        </form>

        <div className="flex gap-2">
          {[
            { value: 'newest', label: '最新' },
            { value: 'popular', label: '最热' },
            { value: 'rating', label: '最高评分' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => { setSort(option.value); setPage(1); }}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                sort === option.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700 border border-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}

          {isAuthenticated && (
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              + 分享配置
            </button>
          )}
        </div>
      </div>

      {showUpload && (
        <div className="mb-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-green-500/30">
          <h3 className="text-lg font-semibold text-white mb-4">分享你的配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">配置名称 *</label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：FPS竞技配置"
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">游戏名称</label>
              <input
                type="text"
                value={uploadForm.game_name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, game_name: e.target.value }))}
                placeholder="例如：CS2"
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">描述</label>
              <input
                type="text"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="简要描述配置特点"
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={uploadConfig}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-lg transition-all"
            >
              上传分享
            </button>
            <button
              onClick={() => setShowUpload(false)}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : configs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-4">🌍</div>
          <p className="text-lg">暂无社区配置</p>
          <p className="text-sm mt-1">成为第一个分享配置的玩家！</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map(config => (
              <div
                key={config.id}
                className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700 hover:border-slate-600 transition-all hover:shadow-xl hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-semibold text-lg leading-tight">{config.name}</h3>
                  <span className="text-purple-400 text-xs ml-2 whitespace-nowrap">
                    {config.game_name || '通用'}
                  </span>
                </div>

                {config.description && (
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{config.description}</p>
                )}

                <div className="mb-3">
                  {renderStars(config.avg_rating, config.rating_count)}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span>👤 {config.author}</span>
                  <span>📥 {config.download_count} 下载</span>
                  <span>{formatDate(config.created_at)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadConfig(config)}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                  >
                    下载应用
                  </button>
                  {isAuthenticated && (
                    <button
                      onClick={() => {
                        setSelectedConfig(selectedConfig?.id === config.id ? null : config);
                        setUserRating(0);
                      }}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                    >
                      ★
                    </button>
                  )}
                </div>

                {selectedConfig?.id === config.id && isAuthenticated && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <p className="text-gray-400 text-sm mb-2">为这个配置评分：</p>
                    {renderRatingInput(config.id)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-8">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-gray-400 text-sm">
                第 {page} / {totalPages} 页 (共 {total} 个)
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommunityHub;