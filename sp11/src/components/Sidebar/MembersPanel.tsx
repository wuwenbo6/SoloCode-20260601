import { Users, Crown, Wifi, WifiOff } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PeerConnection } from '../../types';

const MembersPanel = () => {
  const { roomMembers, peers, currentUser } = useStore();

  const getPeerState = (userId: string): PeerConnection['state'] | 'self' => {
    if (userId === currentUser?.id) return 'self';
    return peers.get(userId)?.state || 'disconnected';
  };

  const getStateColor = (state: PeerConnection['state'] | 'self') => {
    switch (state) {
      case 'self':
        return 'text-green-400';
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'disconnected':
        return 'text-gray-500';
      case 'failed':
        return 'text-red-400';
    }
  };

  const getStateIcon = (state: PeerConnection['state'] | 'self') => {
    if (state === 'connected' || state === 'self') {
      return <Wifi className="w-4 h-4" />;
    }
    return <WifiOff className="w-4 h-4" />;
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/50 border-r border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">在线成员</h2>
        </div>
        <p className="text-sm text-slate-400">
          {roomMembers.length} 人在线
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {roomMembers.map((member) => {
          const state = getPeerState(member.id);
          const stateColor = getStateColor(state);
          const isSelf = member.id === currentUser?.id;

          return (
            <div
              key={member.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                isSelf
                  ? 'bg-violet-500/20 border border-violet-500/30'
                  : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm relative"
                style={{ backgroundColor: member.color }}
              >
                {member.nickname.charAt(0).toUpperCase()}
                {member.isHost && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Crown className="w-3 h-3 text-yellow-900" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium truncate">
                    {member.nickname}
                    {isSelf && (
                      <span className="text-xs text-violet-400 ml-2">(你)</span>
                    )}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-xs ${stateColor}`}>
                  {getStateIcon(state)}
                  <span>
                    {state === 'self'
                      ? '你自己'
                      : state === 'connected'
                      ? '已连接'
                      : state === 'connecting'
                      ? '连接中...'
                      : state === 'disconnected'
                      ? '已断开'
                      : '连接失败'}
                  </span>
                </div>
              </div>

              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: member.color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MembersPanel;
