import React, { useState } from 'react';
import { X, Video, Globe, Hash } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface JoinConferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (serverUrl: string, roomId: number, displayName: string) => void;
}

export const JoinConferenceModal: React.FC<JoinConferenceModalProps> = ({
  isOpen,
  onClose,
  onJoin,
}) => {
  const { config, setJanusConfig } = useAppStore();
  const [serverUrl, setServerUrl] = useState(config.janus.serverUrl);
  const [roomId, setRoomId] = useState(String(config.janus.roomId));
  const [displayName, setDisplayName] = useState(config.janus.displayName);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!serverUrl || !roomId || !displayName) return;

    setIsJoining(true);
    try {
      setJanusConfig({
        serverUrl,
        roomId: parseInt(roomId),
        displayName,
      });
      await onJoin(serverUrl, parseInt(roomId), displayName);
      onClose();
    } catch (error) {
      console.error('Failed to join conference:', error);
    } finally {
      setIsJoining(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">加入视频会议</h3>
              <p className="text-sm text-slate-400">输入会议信息加入房间</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
              <Globe className="w-4 h-4" />
              Janus 服务器地址
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="ws://localhost:8188"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
              <Hash className="w-4 h-4" />
              房间号
            </label>
            <input
              type="number"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="1234"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              显示名称
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="你的名字"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-700 font-medium transition-all"
          >
            取消
          </button>
          <button
            onClick={handleJoin}
            disabled={!serverUrl || !roomId || !displayName || isJoining}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl hover:from-cyan-400 hover:to-purple-400 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isJoining ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                连接中...
              </>
            ) : (
              '加入会议'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
