import { Users, Copy, LogOut } from "lucide-react";
import { useWhiteboardStore } from "@/store/whiteboardStore";
import { getSocket } from "@/hooks/useSocket";
import { useNavigate } from "react-router-dom";

export default function TopBar() {
  const { roomId, users, userId } = useWhiteboardStore();
  const navigate = useNavigate();

  const creator = users[0];
  const isCreator = creator?.id === userId;

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
    }
  };

  const handleLeave = () => {
    if (roomId) {
      const socket = getSocket();
      socket.emit("room:leave", roomId);
    }
    navigate("/");
  };

  return (
    <div className="flex items-center justify-between px-4 h-12 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1a1a2e]">房间</span>
          <span className="px-2 py-0.5 bg-[#1a1a2e] text-white text-xs font-mono rounded">
            {roomId}
          </span>
          <button
            onClick={copyRoomId}
            className="p-1 text-gray-400 hover:text-[#ff6b35] transition-colors"
            title="复制房间号"
          >
            <Copy size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-200" />

        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">{users.length} 在线</span>
        </div>

        <div className="flex -space-x-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: u.color }}
              title={u.name}
            >
              {u.name.charAt(0)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isCreator && (
          <span className="px-2 py-0.5 bg-[#ff6b35]/10 text-[#ff6b35] text-[10px] font-medium rounded">
            创建者
          </span>
        )}
        <button
          onClick={handleLeave}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut size={14} />
          离开
        </button>
      </div>
    </div>
  );
}
