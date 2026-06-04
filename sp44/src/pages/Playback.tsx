import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Subtitles } from 'lucide-react';
import Timeline from '@/components/PlaybackControls';
import { PlaybackControls } from '@/components/PlaybackControls';

interface RecordingMetadata {
  id: string;
  roomId: string;
  roomName: string;
  startTime: number;
  endTime: number;
  duration: number;
  captions: {
    id: string;
    speakerId: string;
    speakerName: string;
    text: string;
    timestamp: number;
  }[];
  chatMessages: {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
  }[];
}

export default function Playback() {
  const { recordingId = '' } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [metadata, setMetadata] = useState<RecordingMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'captions' | 'messages'>('captions');
  const [visibleCaption, setVisibleCaption] = useState<{ text: string; speaker: string } | null>(null);

  useEffect(() => {
    fetch(`/api/recordings/${recordingId}`)
      .then((res) => res.json())
      .then((data) => setMetadata(data.metadata))
      .catch((err) => console.error('Failed to load metadata:', err));
  }, [recordingId]);

  useEffect(() => {
    if (!metadata) return;

    const currentMs = currentTime;
    const currentCaption = metadata.captions.find((c) => {
      const captionMs = c.timestamp - metadata.startTime;
      return captionMs >= currentMs - 2000 && captionMs <= currentMs + 500;
    });

    if (currentCaption) {
      setVisibleCaption({
        text: currentCaption.text,
        speaker: currentCaption.speakerName,
      });
    } else {
      setVisibleCaption(null);
    }
  }, [currentTime, metadata]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime * 1000);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration * 1000);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time / 1000;
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleFullscreen = () => {
    const container = document.getElementById('playback-container');
    if (container?.requestFullscreen) {
      container.requestFullscreen();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!metadata) {
    return (
      <div className="h-screen w-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-white/60">Loading recording...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0a0e27] flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-3 bg-[#0a0e27]/80 backdrop-blur-sm border-b border-white/5">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div>
          <h1 className="text-white font-heading font-semibold text-sm">{metadata.roomName}</h1>
          <p className="text-white/40 text-xs">{formatDate(metadata.startTime)}</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col" id="playback-container">
          <div className="flex-1 bg-black flex items-center justify-center relative">
            <video
              ref={videoRef}
              src={`/api/recordings/${recordingId}/video`}
              className="max-w-full max-h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            {visibleCaption && (
              <div className="absolute bottom-20 left-0 right-0 flex justify-center">
                <div className="bg-black/80 px-6 py-3 rounded-lg max-w-2xl">
                  <p className="text-white/60 text-xs mb-1">{visibleCaption.speaker}</p>
                  <p className="text-white text-base font-medium text-center">{visibleCaption.text}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#161a33] border-t border-white/10">
            <Timeline
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
            />
            <PlaybackControls
              isPlaying={isPlaying}
              isMuted={isMuted}
              volume={volume}
              onPlayPause={handlePlayPause}
              onVolumeToggle={handleVolumeToggle}
              onVolumeChange={handleVolumeChange}
              onFullscreen={handleFullscreen}
            />
          </div>
        </div>

        <div className="w-80 bg-[#161a33] border-l border-white/10 flex flex-col">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('captions')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm transition-colors ${
                activeTab === 'captions'
                  ? 'text-[#00e5a0] border-b-2 border-[#00e5a0]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Subtitles className="w-4 h-4" />
              <span>Captions</span>
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm transition-colors ${
                activeTab === 'messages'
                  ? 'text-[#00e5a0] border-b-2 border-[#00e5a0]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'captions' && (
              <div className="space-y-3">
                {metadata.captions.map((caption) => (
                  <div
                    key={caption.id}
                    className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => handleSeek(caption.timestamp - metadata.startTime)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#00e5a0] text-xs font-medium">{caption.speakerName}</span>
                      <span className="text-white/40 text-xs font-mono">
                        {new Date(caption.timestamp - metadata.startTime).toISOString().substr(14, 5)}
                      </span>
                    </div>
                    <p className="text-white/80 text-sm">{caption.text}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="space-y-3">
                {metadata.chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => handleSeek(msg.timestamp - metadata.startTime)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#00e5a0] text-xs font-medium">{msg.senderName}</span>
                      <span className="text-white/40 text-xs font-mono">
                        {new Date(msg.timestamp - metadata.startTime).toISOString().substr(14, 5)}
                      </span>
                    </div>
                    <p className="text-white/80 text-sm">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
