import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWhiteboardStore } from "@/store/whiteboardStore";
import { useSocket } from "@/hooks/useSocket";
import Canvas from "@/components/Canvas";
import Toolbar from "@/components/Toolbar";
import LayerPanel from "@/components/LayerPanel";
import UserList from "@/components/UserList";
import { Copy, LogOut } from "lucide-react";

export default function Whiteboard() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const { socket } = useSocket();

  const {
    userId,
    userName,
    userColor,
    roomId: storeRoomId,
    setRoomId,
    setUsers,
    setOperations,
    setLayers,
    setActiveLayerId,
    addOperation,
    removeOperationById,
    clearAllOperations,
    addUser,
    removeUser,
    updateCursor,
    removeCursor,
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayers,
    clearLayerOperations,
  } = useWhiteboardStore();

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit("room:join", roomId);

    socket.on("room:joined", (rid, users, operations, layers) => {
      setRoomId(rid);
      setUsers(users);
      setOperations(operations);
      setLayers(layers);
      if (layers.length > 0) {
        const myLayer = layers.find((l: any) => l.userId === userId);
        setActiveLayerId(myLayer?.id || layers[0].id);
      }
    });

    socket.on("room:userJoined", (user) => addUser(user));
    socket.on("room:userLeft", (uid) => {
      removeUser(uid);
      removeCursor(uid);
    });

    socket.on("draw:broadcast", (op) => addOperation(op));
    socket.on("cursor:broadcast", (data) => updateCursor(data));
    socket.on("canvas:cleared", () => clearAllOperations());
    socket.on("undo:broadcast", (opId) => removeOperationById(opId));

    socket.on("layer:created", (layer) => addLayer(layer));
    socket.on("layer:deleted", (layerId) => removeLayer(layerId));
    socket.on("layer:updated", (layer) => updateLayer(layer));
    socket.on("layer:reordered", (layers) => reorderLayers(layers));
    socket.on("layer:cleared", (layerId) => clearLayerOperations(layerId));

    socket.on("error", (msg) => {
      console.error(msg);
      navigate("/");
    });

    return () => {
      socket.emit("room:leave", roomId);
      socket.off("room:joined");
      socket.off("room:userJoined");
      socket.off("room:userLeft");
      socket.off("draw:broadcast");
      socket.off("cursor:broadcast");
      socket.off("canvas:cleared");
      socket.off("undo:broadcast");
      socket.off("layer:created");
      socket.off("layer:deleted");
      socket.off("layer:updated");
      socket.off("layer:reordered");
      socket.off("layer:cleared");
      socket.off("error");
    };
  }, [socket, roomId, navigate, setRoomId, setUsers, setOperations, setLayers, setActiveLayerId, addOperation, removeOperationById, clearAllOperations, addUser, removeUser, updateCursor, removeCursor, userId, addLayer, removeLayer, updateLayer, reorderLayers, clearLayerOperations]);

  const handleCopy = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = () => {
    if (socket && roomId) {
      socket.emit("room:leave", roomId);
    }
    navigate("/");
  };

  if (!storeRoomId) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="animate-pulse text-gray-500">正在加入房间...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      <header className="h-12 flex items-center justify-between px-4 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 z-10">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold bg-gradient-to-r from-[#ff6b35] to-[#f9a826] bg-clip-text text-transparent">
            SyncBoard
          </span>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">房间</span>
            <code className="px-2 py-0.5 bg-gray-100 rounded text-sm font-mono text-gray-700">
              {roomId}
            </code>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="复制房间号"
            >
              <Copy size={14} />
              {copied && (
                <span className="absolute ml-6 text-xs text-[#ff6b35]">已复制!</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <UserList />
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: userColor }}
            />
            <span className="text-sm text-gray-600">{userName}</span>
          </div>
          <button
            onClick={handleLeave}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="离开房间"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        <Canvas />
        <LayerPanel />
      </div>
    </div>
  );
}
