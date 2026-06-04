import { useRef, useEffect } from 'react';
import { Mic, MicOff, User } from 'lucide-react';

interface VideoTileProps {
  stream?: MediaStream | null;
  name: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isLocal?: boolean;
  audioLevel?: number;
}

export default function VideoTile({
  stream,
  name,
  isMuted,
  isCameraOff,
  isLocal = false,
  audioLevel = 0,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && !isCameraOff) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCameraOff]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#111633] shadow-lg group">
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-[#1a2050] flex items-center justify-center">
            <User className="w-10 h-10 text-[#00e5a0]" />
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center gap-2">
          {isMuted ? (
            <MicOff className="w-4 h-4 text-red-400" />
          ) : (
            <div className="relative">
              <Mic className="w-4 h-4 text-[#00e5a0]" />
              {audioLevel > 0 && (
                <div
                  className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-[#00e5a0] animate-pulse"
                  style={{ opacity: Math.min(audioLevel, 1) }}
                />
              )}
            </div>
          )}
          <span className="text-white text-sm font-medium truncate">{name}</span>
        </div>
      </div>
    </div>
  );
}
