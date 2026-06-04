import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMeetingStore } from '@/store/meetingStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import VideoGrid from '@/components/VideoGrid';
import ControlBar from '@/components/ControlBar';
import EncryptionBadge from '@/components/EncryptionBadge';
import ParticipantsPanel from '@/components/ParticipantsPanel';
import ChatPanel from '@/components/ChatPanel';
import CaptionDisplay from '@/components/CaptionDisplay';
import PollPanel from '@/components/PollPanel';
import HandRaiseIndicator from '@/components/HandRaiseIndicator';

export default function Room() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    isEncrypted,
    isRecording,
    isVirtualBgOn,
    setIsVirtualBgOn,
    panelOpen,
    userName,
    sharedKeys,
    isCaptioning,
    setIsCaptioning,
    isHandRaised,
    setIsHandRaised,
    captions,
  } = useMeetingStore();

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
    raiseHand,
    startPoll,
    votePoll,
    endPoll,
    sendCaption,
  } = useWebRTC(roomId);

  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();

  const handleToggleCaptions = useCallback(() => {
    if (isCaptioning) {
      stopListening();
      setIsCaptioning(false);
    } else {
      startListening();
      setIsCaptioning(true);
    }
  }, [isCaptioning, startListening, stopListening, setIsCaptioning]);

  const handleRaiseHand = useCallback(() => {
    raiseHand(!isHandRaised);
  }, [raiseHand, isHandRaised]);

  useEffect(() => {
    if (isCaptioning && transcript && transcript.trim()) {
      sendCaption(transcript);
    }
  }, [transcript, isCaptioning, sendCaption]);

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
          {isListening && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00e5a0]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00e5a0] animate-pulse" />
              <span className="text-[#00e5a0] text-xs font-medium">CC</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <HandRaiseIndicator />
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
        <div className="flex-1 overflow-hidden relative">
          <VideoGrid />
          {isCaptioning && captions.length > 0 && (
            <div className="absolute bottom-20 left-0 right-0 flex justify-center">
              <CaptionDisplay />
            </div>
          )}
        </div>

        {panelOpen === 'participants' && <ParticipantsPanel />}
        {panelOpen === 'chat' && <ChatPanel onSendMessage={sendChatMessage} />}
        {panelOpen === 'poll' && (
          <PollPanel
            onStartPoll={startPoll}
            onVote={votePoll}
            onEndPoll={endPoll}
          />
        )}
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
            onToggleCaptions={handleToggleCaptions}
            onRaiseHand={handleRaiseHand}
            onLeave={handleLeave}
          />
        </div>
      </div>
    </div>
  );
}
