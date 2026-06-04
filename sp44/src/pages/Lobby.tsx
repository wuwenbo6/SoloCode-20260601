import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Mic, ArrowRight, Copy, Check, Shield } from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';
import { useEncryption } from '@/hooks/useEncryption';
import DeviceSelector from '@/components/DeviceSelector';

export default function Lobby() {
  const navigate = useNavigate();
  const { setUserName, setRoomId, setIsHost, setLocalStream, isMuted, isCameraOff, setIsMuted, setIsCameraOff } =
    useMeetingStore();
  const { generateKeyPair } = useEncryption();

  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const startPreview = async (videoDeviceId?: string, audioDeviceId?: string) => {
    try {
      if (previewStream) {
        previewStream.getTracks().forEach((t) => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setPreviewStream(stream);
      setLocalStream(stream);
    } catch {}
  };

  useEffect(() => {
    startPreview();
    return () => {
      previewStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && previewStream && !isCameraOff) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream, isCameraOff]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const roomId = crypto.randomUUID().slice(0, 8);
    setUserName(name.trim());
    setRoomId(roomId);
    setIsHost(true);
    setCreatedRoomId(roomId);
    await generateKeyPair();
    navigate(`/room/${roomId}`);
  };

  const handleJoin = async () => {
    if (!name.trim() || !joinId.trim()) return;
    setUserName(name.trim());
    setRoomId(joinId.trim());
    setIsHost(false);
    await generateKeyPair();
    navigate(`/room/${joinId.trim()}`);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(createdRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1540] to-[#0a0e27] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
        <div className="glass-card p-8 rounded-3xl">
          <div className="mb-6">
            <h1 className="text-3xl font-heading font-bold text-white mb-2">
              SecureMeet
            </h1>
            <p className="text-white/50 text-sm flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#00e5a0]" />
              End-to-end encrypted video conferencing
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 outline-none focus:border-[#00e5a0]/50 focus:ring-1 focus:ring-[#00e5a0]/30 transition-all"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="w-full py-3.5 bg-[#00e5a0] hover:bg-[#00e5a0]/90 text-[#0a0e27] font-semibold rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_30px_rgba(0,229,160,0.3)] disabled:opacity-30"
            >
              Create Meeting
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[#0d1230] text-white/30">or join existing</span>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Enter room ID"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 outline-none focus:border-[#00e5a0]/50 focus:ring-1 focus:ring-[#00e5a0]/30 transition-all"
              />
              <button
                onClick={handleJoin}
                disabled={!name.trim() || !joinId.trim()}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl disabled:opacity-30 transition-all"
              >
                Join
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#00e5a0]/5 border border-[#00e5a0]/20 rounded-xl">
              <Shield className="w-4 h-4 text-[#00e5a0]" />
              <span className="text-[#00e5a0]/80 text-xs">
                All meetings are protected with ECDH + AES-256-GCM end-to-end encryption
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-3xl flex flex-col">
          <h3 className="text-white font-heading font-semibold mb-4">Device Preview</h3>

          <div className="relative flex-1 rounded-2xl overflow-hidden bg-[#111633] mb-4 min-h-[280px]">
            {previewStream && !isCameraOff ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#1a2050] flex items-center justify-center">
                  <Video className="w-8 h-8 text-white/30" />
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              {isMuted ? (
                <div className="px-2 py-1 bg-red-500/80 rounded-lg text-[10px] text-white">Muted</div>
              ) : (
                <div className="px-2 py-1 bg-[#00e5a0]/20 rounded-lg text-[10px] text-[#00e5a0]">
                  <Mic className="w-3 h-3 inline mr-1" />
                  Mic On
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isMuted ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <Mic className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => setIsCameraOff(!isCameraOff)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isCameraOff ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <Video className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="space-y-2">
            <DeviceSelector
              kind="videoinput"
              label="Camera"
              onSelect={(id) => {
                const audioId = previewStream?.getAudioTracks()[0]?.getSettings()?.deviceId;
                startPreview(id, audioId);
              }}
            />
            <DeviceSelector
              kind="audioinput"
              label="Microphone"
              onSelect={(id) => {
                const videoId = previewStream?.getVideoTracks()[0]?.getSettings()?.deviceId;
                startPreview(videoId, id);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
