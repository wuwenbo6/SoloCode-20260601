import { useState } from 'react';
import { Copy, Check, LogOut, Wifi, WifiOff, Users, Save } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import { NotificationPanel } from '../Notifications/NotificationPanel';

interface HeaderProps {
  roomId: string;
  roomName?: string;
  connectionStatus?: string;
  connectionStatusText?: string;
  connectionStatusColor?: string;
  isOnline?: boolean;
  onSaveNow?: () => void;
  onLeaveRoom?: () => void;
}

const Header = ({
  roomId,
  roomName,
  connectionStatus,
  connectionStatusText,
  connectionStatusColor,
  isOnline = true,
  onSaveNow,
  onLeaveRoom,
}: HeaderProps) => {
  const { currentRoom, currentUser, roomMembers, reset } = useStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleLeave = () => {
    if (onLeaveRoom) {
      onLeaveRoom();
    } else {
      reset();
      navigate('/');
    }
  };

  const finalRoomName = roomName || currentRoom?.name || '协作编辑器';

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">Co</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">
              {finalRoomName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
          <code className="text-violet-400 font-mono text-sm">{roomId}</code>
          <button
            onClick={copyRoomId}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="复制房间号"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400 hover:text-white" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300">{roomMembers.length}</span>
          </div>

          <div className={`flex items-center gap-2 text-sm ${isOnline ? connectionStatusColor || '' : 'text-orange-400'}`}>
            {isOnline ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span>{isOnline ? (connectionStatusText || '') : '离线模式'}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        {onSaveNow && (
          <button
            onClick={onSaveNow}
            className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors text-sm"
            title="立即保存版本"
          >
            <Save className="w-4 h-4" />
            <span>保存</span>
          </button>
        )}

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          <NotificationPanel />

          {currentUser && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.nickname.charAt(0).toUpperCase()}
            </div>
          )}

          <button
            onClick={handleLeave}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="离开房间"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
export { Header };
