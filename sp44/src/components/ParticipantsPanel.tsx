import { X, Mic, MicOff, Crown, UserMinus } from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';

export default function ParticipantsPanel() {
  const { participants, userName, isHost, setPanelOpen } = useMeetingStore();

  return (
    <div className="w-80 h-full bg-[#0d1230]/95 backdrop-blur-xl border-l border-white/10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <h3 className="text-white font-heading font-semibold text-lg">Participants</h3>
        <button
          onClick={() => setPanelOpen('none')}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-4 py-2">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
            You ({participants.length + 1})
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#00e5a0]/20 flex items-center justify-center text-[#00e5a0] text-xs font-bold">
              {(userName || 'Y')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">
                {userName || 'You'}
                {isHost && <Crown className="w-3 h-3 inline ml-1 text-yellow-400" />}
              </div>
            </div>
          </div>

          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#1a2050] flex items-center justify-center text-white/60 text-xs font-bold">
                {p.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">
                  {p.name}
                  {p.isHost && <Crown className="w-3 h-3 inline ml-1 text-yellow-400" />}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {p.isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-[#00e5a0]" />
                )}
                {isHost && (
                  <button className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors">
                    <UserMinus className="w-3.5 h-3.5 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
