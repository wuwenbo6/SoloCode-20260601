import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  Users,
  Settings,
  MonitorUp,
} from 'lucide-react';
import { Participant } from '@/types';

interface ConferenceControlsProps {
  isConnected: boolean;
  isInRoom: boolean;
  participants: Participant[];
  videoEnabled: boolean;
  audioEnabled: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onOpenSettings?: () => void;
  onToggleParticipants?: () => void;
}

export const ConferenceControls: React.FC<ConferenceControlsProps> = ({
  isConnected,
  isInRoom,
  participants,
  videoEnabled,
  audioEnabled,
  onToggleVideo,
  onToggleAudio,
  onJoin,
  onLeave,
  onOpenSettings,
  onToggleParticipants,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4">
          <div className="flex items-center justify-center gap-4">
            {onToggleParticipants && (
              <button
                onClick={onToggleParticipants}
                className="relative p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
                title="参与者"
              >
                <Users className="w-6 h-6" />
                {participants.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {participants.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onToggleAudio}
              className={`p-4 rounded-2xl transition-all duration-200 ${
                audioEnabled
                  ? 'bg-slate-700/80 text-white hover:bg-slate-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title={audioEnabled ? '静音' : '取消静音'}
            >
              {audioEnabled ? (
                <Mic className="w-6 h-6" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </button>

            <button
              onClick={onToggleVideo}
              className={`p-4 rounded-2xl transition-all duration-200 ${
                videoEnabled
                  ? 'bg-slate-700/80 text-white hover:bg-slate-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title={videoEnabled ? '关闭摄像头' : '开启摄像头'}
            >
              {videoEnabled ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
              )}
            </button>

            {!isInRoom ? (
              <button
                onClick={onJoin}
                disabled={!isConnected}
                className={`p-4 rounded-2xl transition-all duration-200 ${
                  isConnected
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
                title="加入会议"
              >
                <Phone className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={onLeave}
                className="p-4 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-all duration-200"
                title="离开会议"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            )}

            <button
              className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
              title="共享屏幕"
            >
              <MonitorUp className="w-6 h-6" />
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
                title="设置"
              >
                <Settings className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
