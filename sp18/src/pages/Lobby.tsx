import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "@/hooks/useSocket";
import { useWhiteboardStore } from "@/store/whiteboardStore";
import { Pencil, LogIn, Sparkles } from "lucide-react";

export default function Lobby() {
  const [roomIdInput, setRoomIdInput] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const { setUserId, setUserName, setUserColor, setRoomId, setUsers, setOperations, userId } =
    useWhiteboardStore();
  const navigate = useNavigate();

  const handleCreate = () => {
    const name = userNameInput.trim() || `用户${userId.substring(0, 4)}`;
    setUserName(name);
    const socket = getSocket();

    socket.on("room:created", (rid) => {
      setRoomId(rid);
      socket.off("room:created");
      navigate(`/room/${rid}`);
    });

    socket.on("room:joined", (rid, users, ops) => {
      setRoomId(rid);
      setUsers(users);
      setOperations(ops);
      socket.off("room:joined");
    });

    socket.emit("room:create");
  };

  const handleJoin = () => {
    const rid = roomIdInput.trim().toUpperCase();
    if (!rid) return;
    const name = userNameInput.trim() || `用户${userId.substring(0, 4)}`;
    setUserName(name);
    const socket = getSocket();

    socket.on("room:joined", (rid, users, ops) => {
      setRoomId(rid);
      setUsers(users);
      setOperations(ops);
      socket.off("room:joined");
      navigate(`/room/${rid}`);
    });

    socket.on("error", (msg) => {
      alert(msg);
      socket.off("error");
    });

    socket.emit("room:join", rid);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#ff6b35] shadow-lg shadow-[#ff6b35]/30 mb-4">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            SyncBoard
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            多人实时协作白板 · 智能图形识别
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              你的昵称
            </label>
            <input
              type="text"
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              placeholder="输入昵称..."
              className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/50 focus:border-[#ff6b35]/50 transition-all"
            />
          </div>

          <button
            onClick={handleCreate}
            className="w-full py-3 bg-[#ff6b35] hover:bg-[#e85a24] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[#ff6b35]/30 hover:shadow-[#ff6b35]/50 flex items-center justify-center gap-2 mb-5"
          >
            <Pencil size={18} />
            创建房间
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">或者加入已有房间</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="输入房间号"
              className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/50 focus:border-[#ff6b35]/50 transition-all"
            />
            <button
              onClick={handleJoin}
              disabled={!roomIdInput.trim()}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 border border-white/10"
            >
              <LogIn size={18} />
              加入
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-[10px] mt-6">
          支持画笔 · 矩形 · 圆形 · 线条 · 橡皮擦 · 图形自动修正 · 手势缩放
        </p>
      </div>
    </div>
  );
}
