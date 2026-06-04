import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Trash2, Clock, Users } from 'lucide-react';

interface Recording {
  id: string;
  roomId: string;
  roomName: string;
  startTime: number;
  endTime: number;
  duration: number;
  participants: { id: string; name: string }[];
}

export default function Recordings() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/recordings')
      .then((res) => res.json())
      .then((data) => {
        setRecordings(data.recordings || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load recordings:', err);
        setLoading(false);
      });
  }, []);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个录像吗？')) {
      fetch(`/api/recordings/${id}`, { method: 'DELETE' })
        .then(() => {
          setRecordings((prev) => prev.filter((r) => r.id !== id));
        })
        .catch((err) => console.error('Failed to delete recording:', err));
    }
  };

  const handlePlay = (id: string) => {
    navigate(`/playback/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-white font-heading text-2xl font-bold mb-2">会议录像</h1>
          <p className="text-white/60 text-sm">查看和回放已录制的会议</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white/60">加载中...</div>
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-white/40" />
            </div>
            <p className="text-white/60 text-lg mb-2">暂无录像</p>
            <p className="text-white/40 text-sm">开始会议录制后，录像将显示在这里</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-[#161a33] rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all hover:shadow-[0_0_30px_rgba(0,229,160,0.1)] cursor-pointer group"
                onClick={() => handlePlay(recording.id)}
              >
                <div className="aspect-video bg-gradient-to-br from-[#1a1f3d] to-[#0d1128] relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#00e5a0]/20 flex items-center justify-center group-hover:bg-[#00e5a0]/30 transition-colors">
                      <Play className="w-8 h-8 text-[#00e5a0] ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded text-white text-xs font-mono">
                    {formatDuration(recording.duration)}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm mb-2 truncate">
                    {recording.roomName || '未命名会议'}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(recording.startTime)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{recording.participants.length} 参与者</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(recording.id, e)}
                      className="ml-auto p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
