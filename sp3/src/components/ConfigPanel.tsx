import { useState } from 'react';
import { Settings, Shuffle, Play, Plus, Trash2, GitBranch, Gauge, Cpu } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { cn } from '../lib/utils';

export default function ConfigPanel() {
  const { params, setParams, simulate, isLoading } = useSimulationStore();
  const [showCustomSids, setShowCustomSids] = useState(false);
  const [customSidInput, setCustomSidInput] = useState('');

  const handleAddSid = () => {
    if (customSidInput.trim()) {
      const currentSids = params.customSids || [];
      setParams({ customSids: [...currentSids, customSidInput.trim()] });
      setCustomSidInput('');
    }
  };

  const handleRemoveSid = (index: number) => {
    const currentSids = params.customSids || [];
    setParams({ customSids: currentSids.filter((_, i) => i !== index) });
  };

  const handleGenerateRandom = () => {
    setParams({
      customSids: [],
      prefix: '',
    });
    setShowCustomSids(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    simulate();
  };

  return (
    <div className="glass-card p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary-500/20 rounded-lg">
          <Settings className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">模拟配置</h2>
          <p className="text-sm text-gray-400">配置SRv6模拟参数</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              SID 数量
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={params.sidCount || 5}
              onChange={(e) => setParams({ sidCount: parseInt(e.target.value) || 5 })}
              className="input-field"
              placeholder="输入SID数量 (1-20)"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Cpu className="w-4 h-4 text-primary-400" />
              SID 格式
            </label>
            <select
              value={params.sidFormat || 'srv6'}
              onChange={(e) => setParams({ sidFormat: e.target.value as 'srv6' | 'usid' })}
              className="input-field appearance-none cursor-pointer"
            >
              <option value="srv6">SRv6 (128-bit SID)</option>
              <option value="usid">uSID (32-bit 微段)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {params.sidFormat === 'usid' 
                ? 'RFC 9403: 每个Carrier可打包4个uSID' 
                : 'RFC 8754: 标准SRv6 SID格式'}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            压缩方法
          </label>
          <select
            value={params.compressionMethod || 'prefix'}
            onChange={(e) => setParams({ compressionMethod: e.target.value as 'prefix' | 'full' })}
            className="input-field appearance-none cursor-pointer"
          >
            <option value="prefix">前缀压缩</option>
            <option value="full">完全压缩 (去重)</option>
          </select>
        </div>

        {params.compressionMethod === 'prefix' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Gauge className="w-4 h-4 text-primary-400" />
                  压缩深度
                </label>
                <span className="text-sm font-mono text-primary-400">
                  {params.compressionDepth || 8} 个 hextets
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                value={params.compressionDepth || 8}
                onChange={(e) => setParams({ compressionDepth: parseInt(e.target.value) })}
                className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>浅 (1)</span>
                <span>深 (8)</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                指定最多压缩前 N 个 hextets 的公共前缀
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-dark-600">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent-400" />
                <div>
                  <p className="text-sm font-medium text-gray-300">保留分支节点</p>
                  <p className="text-xs text-gray-500">只压缩无分支的直连路径，在分支点保留完整SID</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.preserveBranches !== false}
                  onChange={(e) => setParams({ preserveBranches: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {params.sidFormat === 'usid' ? 'uSID Block 前缀 (可选)' : '公共前缀 (可选)'}
          </label>
          <input
            type="text"
            value={params.prefix || ''}
            onChange={(e) => setParams({ prefix: e.target.value })}
            className="input-field font-mono text-sm"
            placeholder={params.sidFormat === 'usid' ? '例如: fc00:0000::' : '例如: 2001:db8:1234::'}
          />
          <p className="mt-1 text-xs text-gray-500">
            {params.sidFormat === 'usid' 
              ? 'uSID Block前缀 (32位)，留空自动生成' 
              : '留空则自动生成随机前缀'}
          </p>
        </div>

        <div className="border-t border-dark-600 pt-4">
          <button
            type="button"
            onClick={() => setShowCustomSids(!showCustomSids)}
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors",
              showCustomSids ? "text-primary-400" : "text-gray-400 hover:text-gray-300"
            )}
          >
            <Plus className="w-4 h-4" />
            自定义 SID 列表
          </button>

          {showCustomSids && (
            <div className="mt-4 space-y-3 animate-fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSidInput}
                  onChange={(e) => setCustomSidInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSid())}
                  className="input-field flex-1 font-mono text-sm"
                  placeholder="输入IPv6地址，例如: 2001:db8::1"
                />
                <button
                  type="button"
                  onClick={handleAddSid}
                  className="btn-secondary px-4"
                >
                  添加
                </button>
              </div>

              {params.customSids && params.customSids.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                  {params.customSids.map((sid, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-dark-600"
                    >
                      <code className="text-sm font-mono text-primary-300">{sid}</code>
                      <button
                        type="button"
                        onClick={() => handleRemoveSid(index)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerateRandom}
            className="btn-secondary flex items-center gap-2"
          >
            <Shuffle className="w-4 h-4" />
            随机生成
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "btn-primary flex-1 flex items-center justify-center gap-2",
              isLoading && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                模拟中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                开始模拟
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
