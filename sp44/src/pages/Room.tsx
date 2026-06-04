import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMeetingStore } from '@/store/meetingStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import VideoGrid from '@/components/VideoGrid';
import ControlBar from '@/components/ControlBar';
import EncryptionBadge from '@/components/EncryptionBadge';
import ParticipantsPanel from '@/components/ParticipantsPanel';
import ChatPanel from '@/components/ChatPanel';

export default function Room() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { isEncrypted, isRecording, isVirtualBgOn, setIsVirtualBgOn, panelOpen, userName, sharedKeys } =
    useMeetingStore();

  const {
    connected,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    sendChatMessage,
    leaveMeeting,
  } = useWebRTC(roomId);

  useEffect(() => {
    useMeetingStore.getState().setRoomId(roomId);
  }, [roomId]);

  const fingerprint = sharedKeys.size > 0
    ? Array.from(sharedKeys.keys())[0].slice(0, 23).split('').reduce((acc, c, i) => {
        if (i > 0 && i % 2 === 0) acc += ':';
        acc += c.charCodeAt(0).toString(16).padStart(2, '0');
        return acc;
      }, '').slice(0, 23)
    : undefined;

  const handleLeave = () => {
    leaveMeeting();
    navigate('/');
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0e27] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-[#0a0e27]/80 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-heading font-semibold text-sm">{userName || 'Meeting'}</h2>
          <span className="text-white/30 text-xs font-mono">Room: {roomId}</span>
          {connected && (
            <div className="w-2 h-2 rounded-full bg-[#00e5a0] animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <EncryptionBadge isEncrypted={isEncrypted} fingerprint={fingerprint} />
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-xs font-medium">REC</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <VideoGrid />
        </div>

        {panelOpen === 'participants' && <ParticipantsPanel />}
        {panelOpen === 'chat' && <ChatPanel onSendMessage={sendChatMessage} />}
      </div>

      <div className="relative">
        <div className="absolute bottom-0 left-0 right-0 glass-bar">
          <ControlBar
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            onStartScreenShare={startScreenShare}
            onStopScreenShare={stopScreenShare}
            onToggleVirtualBg={() => setIsVirtualBgOn(!isVirtualBgOn)}
            onToggleRecording={handleToggleRecording}
            onLeave={handleLeave}
          />
        </div>
      </div>
    </div>
  );
}
