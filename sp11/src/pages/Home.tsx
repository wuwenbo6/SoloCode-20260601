import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Users, Zap, Shield, ArrowRight, Loader2, GitBranch, Clock, Sparkles } from 'lucide-react';
import { api } from '../utils/api';
import { useStore } from '../store/useStore';

const Home = () => {
  const navigate = useNavigate();
  const { setCurrentUser, setCurrentRoom, setIceServers, setRoomMembers, setEditorContent, setConnectionStatus, setError } = useStore();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [nickname, setNickname] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.createRoom({
        nickname: nickname.trim(),
        roomName: roomName.trim() || undefined,
        password: password || undefined,
      });

      setCurrentUser(result.user);
      setIceServers(result.iceServers);
      setRoomMembers([result.user]);
      setEditorContent('');
      setConnectionStatus('connecting');

      navigate(`/room/${result.roomId}`);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.joinRoom(roomId.trim().toUpperCase(), {
        nickname: nickname.trim(),
        roomId: roomId.trim().toUpperCase(),
        password: password || undefined,
      });

      setCurrentUser(result.user);
      setCurrentRoom(result.room);
      setIceServers(result.iceServers);
      setRoomMembers(result.members);
      setEditorContent(result.currentContent);
      setConnectionStatus('connecting');

      navigate(`/room/${roomId.trim().toUpperCase()}`);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: '实时协作',
      description: '基于WebRTC的P2P连接，毫秒级延迟，多人同时编辑'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: '多用户光标',
      description: '每个用户的光标位置实时同步，用不同颜色区分'
    },
    {
      icon: <GitBranch className="w-6 h-6" />,
      title: '版本控制',
      description: '每5分钟自动保存版本，随时回溯历史记录'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: '安全加密',
      description: '端到端加密传输，房间密码保护，数据安全'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM3YzNhZWQiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0aDZ2NkgzNnYtNnptLTEyLTZoNnY2aC02di02em0xMi0xMmg2djZoLTZ2LTZ6TTEyIDM0aDZ2NkgxMnYtNnptMTItMTJoNnY2SDI0di02em0xMi0xMmg2djZoLTZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
      
      <div className="relative z-10">
        <header className="px-6 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Code2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wider">CO-CODE</h1>
                <p className="text-xs text-violet-400">Real-time Collaborative Editor</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="w-4 h-4" />
              <span>v1.0.0</span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-violet-300">全新协作体验</span>
                </div>
                <h2 className="text-5xl font-bold text-white leading-tight">
                  实时<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">协同编码</span>
                  <br />前所未有的高效
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed">
                  基于WebRTC技术的P2P实时协作编辑器，让团队协作更加高效。
                  多光标实时同步，版本自动保存，随时随地回溯历史。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-violet-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center text-violet-400 mb-3">
                      {feature.icon}
                    </div>
                    <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pl-8">
              <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/30 overflow-hidden">
                <div className="flex border-b border-slate-700/50">
                  <button
                    onClick={() => setMode('create')}
                    className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-300 ${
                      mode === 'create'
                        ? 'text-violet-400 bg-violet-500/10 border-b-2 border-violet-500'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
                    }`}
                  >
                    创建房间
                  </button>
                  <button
                    onClick={() => setMode('join')}
                    className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-300 ${
                      mode === 'join'
                        ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-500'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
                    }`}
                  >
                    加入房间
                  </button>
                </div>

                <div className="p-8">
                  <form onSubmit={mode === 'create' ? handleCreateRoom : handleJoinRoom} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        你的昵称 <span className="text-violet-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="输入你的昵称"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        required
                      />
                    </div>

                    {mode === 'create' ? (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          房间名称
                        </label>
                        <input
                          type="text"
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          placeholder="给你的房间起个名字（可选）"
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          房间ID <span className="text-cyan-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={roomId}
                          onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                          placeholder="输入6位房间ID"
                          maxLength={6}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-mono tracking-widest text-center text-lg"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        房间密码 {mode === 'create' && <span className="text-slate-500 font-normal">(可选)</span>}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'create' ? '设置房间密码（可选）' : '输入房间密码'}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                      />
                    </div>

                    {useStore.getState().error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-sm text-red-400">{useStore.getState().error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !nickname.trim() || (mode === 'join' && !roomId.trim())}
                      className={`w-full py-4 px-6 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                        mode === 'create'
                          ? 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50'
                          : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50'
                      }`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>处理中...</span>
                        </>
                      ) : (
                        <>
                          <span>{mode === 'create' ? '创建房间' : '加入房间'}</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  房间创建后，将自动生成6位房间ID，分享给你的队友即可开始协作
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 py-8 mt-12 border-t border-slate-800">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Code2 className="w-4 h-4" />
              <span>CO-CODE © 2025 - 实时协作编辑器</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span>Powered by WebRTC</span>
              <span>•</span>
              <span>Built with React + Node.js</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
