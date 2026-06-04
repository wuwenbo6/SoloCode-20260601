import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Save, RotateCcw, GitCompare, Loader2, CheckCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Version } from '../../types';

interface VersionPanelProps {
  onRestoreVersion?: (versionId: string) => void;
  onManualSave?: () => void;
}

const VersionPanel = ({ onRestoreVersion, onManualSave }: VersionPanelProps) => {
  const { roomId } = useParams<{ roomId: string }>();
  const { currentUser, editorContent, setEditorContent } = useStore();
  const { versions, saveVersion, restoreVersion, loadVersions } = useAutoSave(roomId);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSave = async () => {
    if (!currentUser || saving) return;

    setSaving(true);
    try {
      await saveVersion(false, saveMessage || 'Manual save');
      setSaveMessage('');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version: Version) => {
    if (!currentUser || restoringId) return;

    setRestoringId(version.id);
    try {
      const restored = await restoreVersion(version.id);
      if (restored) {
        setEditorContent(restored.content);
        setViewingVersion(null);
      }
    } finally {
      setRestoringId(null);
    }
  };

  const handleView = (version: Version) => {
    if (viewingVersion?.id === version.id) {
      setViewingVersion(null);
      loadVersions();
    } else {
      setViewingVersion(version);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/50 border-l border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">版本历史</h2>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={saveMessage}
            onChange={(e) => setSaveMessage(e.target.value)}
            placeholder="保存备注（可选）"
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? '保存中...' : '手动保存'}
          </button>
        </div>
      </div>

      {viewingVersion && (
        <div className="p-4 border-b border-slate-700 bg-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cyan-400 font-medium">正在预览版本</span>
            <button
              onClick={() => setViewingVersion(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              返回编辑
            </button>
          </div>
          <div className="max-h-40 overflow-auto bg-slate-900 rounded-lg p-3">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
              {viewingVersion.content.slice(0, 500)}
              {viewingVersion.content.length > 500 && '...'}
            </pre>
          </div>
          <button
            onClick={() => handleRestore(viewingVersion)}
            disabled={restoringId === viewingVersion.id}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white rounded-lg transition-colors text-sm"
          >
            {restoringId === viewingVersion.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {restoringId === viewingVersion.id ? '恢复中...' : '恢复到此版本'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {versions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无版本记录</p>
            <p className="text-xs mt-1">每5分钟自动保存</p>
          </div>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                viewingVersion?.id === version.id
                  ? 'bg-cyan-500/20 border-cyan-500/50'
                  : 'bg-slate-700/30 hover:bg-slate-700/50 border-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {version.autoSaved ? (
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    )}
                    <span className="text-xs text-slate-400">
                      {formatDate(version.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium truncate">
                    {version.message || (version.autoSaved ? '自动保存' : '手动保存')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {version.content.slice(0, 80)}
                    {version.content.length > 80 && '...'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView(version);
                    }}
                    className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                    title="查看版本"
                  >
                    <GitCompare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(version);
                    }}
                    disabled={restoringId === version.id}
                    className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-orange-400 transition-colors disabled:opacity-50"
                    title="恢复版本"
                  >
                    {restoringId === version.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VersionPanel;
