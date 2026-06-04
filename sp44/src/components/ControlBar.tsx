import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Image,
  Circle,
  PhoneOff,
  Users,
  MessageSquare,
} from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';

interface ControlBarProps {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onToggleVirtualBg: () => void;
  onToggleRecording: () => void;
  onLeave: () => void;
}

export default function ControlBar({
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onToggleVirtualBg,
  onToggleRecording,
  onLeave,
}: ControlBarProps) {
  const {
    isMuted,
    isCameraOff,
    isScreenSharing,
    isVirtualBgOn,
    isRecording,
    panelOpen,
    setPanelOpen,
  } = useMeetingStore();

  const btnBase =
    'relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95';
  const btnGlass =
    'bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 hover:shadow-[0_0_20px_rgba(0,229,160,0.3)]';
  const btnOff = 'bg-red-500/80 hover:bg-red-500 border border-red-400/30';

  return (
    <div className="flex items-center justify-center gap-3 px-6 py-4">
      <button
        onClick={onToggleMic}
        className={`${btnBase} ${isMuted ? btnOff : btnGlass}`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
      </button>

      <button
        onClick={onToggleCamera}
        className={`${btnBase} ${isCameraOff ? btnOff : btnGlass}`}
        title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
      >
        {isCameraOff ? (
          <VideoOff className="w-5 h-5 text-white" />
        ) : (
          <Video className="w-5 h-5 text-white" />
        )}
      </button>

      <button
        onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        className={`${btnBase} ${isScreenSharing ? 'bg-[#00e5a0]/30 border border-[#00e5a0]/50' : btnGlass}`}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      >
        <MonitorUp className="w-5 h-5 text-white" />
      </button>

      <button
        onClick={onToggleVirtualBg}
        className={`${btnBase} ${isVirtualBgOn ? 'bg-[#00e5a0]/30 border border-[#00e5a0]/50' : btnGlass}`}
        title="Virtual background"
      >
        <Image className="w-5 h-5 text-white" />
      </button>

      <button
        onClick={onToggleRecording}
        className={`${btnBase} ${isRecording ? 'bg-red-600 border border-red-400 animate-pulse' : btnGlass}`}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <Circle className={`w-5 h-5 ${isRecording ? 'text-white fill-white' : 'text-white'}`} />
      </button>

      <div className="w-px h-8 bg-white/10 mx-1" />

      <button
        onClick={() => setPanelOpen(panelOpen === 'participants' ? 'none' : 'participants')}
        className={`${btnBase} ${panelOpen === 'participants' ? 'bg-[#00e5a0]/20 border border-[#00e5a0]/40' : btnGlass}`}
        title="Participants"
      >
        <Users className="w-5 h-5 text-white" />
      </button>

      <button
        onClick={() => setPanelOpen(panelOpen === 'chat' ? 'none' : 'chat')}
        className={`${btnBase} ${panelOpen === 'chat' ? 'bg-[#00e5a0]/20 border border-[#00e5a0]/40' : btnGlass}`}
        title="Chat"
      >
        <MessageSquare className="w-5 h-5 text-white" />
      </button>

      <div className="w-px h-8 bg-white/10 mx-1" />

      <button
        onClick={onLeave}
        className={`${btnBase} bg-red-600 hover:bg-red-500 border border-red-400/30 hover:shadow-[0_0_20px_rgba(255,0,0,0.3)]`}
        title="Leave meeting"
      >
        <PhoneOff className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
