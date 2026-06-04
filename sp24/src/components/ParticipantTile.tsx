import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, User } from 'lucide-react';
import { Participant } from '@/types';

interface ParticipantTileProps {
  participant: Participant;
  isDominant?: boolean;
  onClick?: () => void;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isDominant = false,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (participant.stream && participant.videoEnabled) {
      video.srcObject = participant.stream;
      video.muted = participant.isLocal;
      video.playsInline = true;
      video.play().catch((e) => {
        console.warn('Failed to autoplay video:', e);
      });
    }

    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [participant.stream, participant.videoEnabled, participant.isLocal]);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden bg-slate-800 transition-all duration-300 ${
        isDominant ? 'col-span-2 row-span-2' : ''
      } ${participant.isSpeaking ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''}`}
    >
      {participant.stream && participant.videoEnabled ? (
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${participant.isLocal ? 'scale-x-[-1]' : ''}`}
          autoPlay
          playsInline
          muted={participant.isLocal}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
          <div className="w-24 h-24 rounded-full bg-slate-600 flex items-center justify-center">
            <User className="w-12 h-12 text-slate-400" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      <div className="absolute top-3 left-3 flex gap-2">
        {participant.isLocal && (
          <span className="px-2 py-1 bg-cyan-500/80 text-white text-xs font-medium rounded-md">
            你
          </span>
        )}
        {participant.isSpeaking && (
          <span className="px-2 py-1 bg-green-500/80 text-white text-xs font-medium rounded-md flex items-center gap-1 animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full" />
            说话中
          </span>
        )}
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm drop-shadow-lg">
            {participant.displayName}
          </span>
        </div>
        <div className="flex gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              participant.audioEnabled ? 'bg-slate-600/80' : 'bg-red-500/80'
            }`}
          >
            {participant.audioEnabled ? (
              <Mic className="w-4 h-4 text-white" />
            ) : (
              <MicOff className="w-4 h-4 text-white" />
            )}
          </div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              participant.videoEnabled ? 'bg-slate-600/80' : 'bg-red-500/80'
            }`}
          >
            {participant.videoEnabled ? (
              <Video className="w-4 h-4 text-white" />
            ) : (
              <VideoOff className="w-4 h-4 text-white" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
