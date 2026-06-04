import { Eye, EyeOff, Plus, Trash2, ChevronUp, ChevronDown, Type } from "lucide-react";
import { useWhiteboardStore } from "@/store/whiteboardStore";
import { getSocket } from "@/hooks/useSocket";
import { generateId } from "../../shared/types";
import type { Layer } from "../../shared/types";

export default function LayerPanel() {
  const {
    userId,
    roomId,
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayers,
    clearLayerOperations,
  } = useWhiteboardStore();

  const myLayers = layers.filter((l) => l.userId === userId);
  const otherLayers = layers.filter((l) => l.userId !== userId);

  const handleAddLayer = () => {
    if (!roomId) return;
    const newLayer: Layer = {
      id: `layer-${generateId()}`,
      name: `图层 ${myLayers.length + 1}`,
      userId,
      visible: true,
      zIndex: layers.length,
      createdAt: Date.now(),
    };
    addLayer(newLayer);
    setActiveLayerId(newLayer.id);
    const socket = getSocket();
    socket.emit("layer:create", roomId, newLayer);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (!roomId || myLayers.length <= 1) return;
    removeLayer(layerId);
    if (activeLayerId === layerId) {
      const remaining = myLayers.filter((l) => l.id !== layerId);
      if (remaining.length > 0) setActiveLayerId(remaining[0].id);
    }
    const socket = getSocket();
    socket.emit("layer:delete", roomId, layerId);
  };

  const handleToggleVisible = (layer: Layer) => {
    if (!roomId || layer.userId !== userId) return;
    const updated = { ...layer, visible: !layer.visible };
    updateLayer(updated);
    const socket = getSocket();
    socket.emit("layer:update", roomId, updated);
  };

  const handleMoveLayer = (layerId: string, direction: "up" | "down") => {
    if (!roomId) return;
    const idx = myLayers.findIndex((l) => l.id === layerId);
    if (idx === -1) return;
    const newLayers = [...myLayers];
    if (direction === "up" && idx < myLayers.length - 1) {
      [newLayers[idx], newLayers[idx + 1]] = [newLayers[idx + 1], newLayers[idx]];
    } else if (direction === "down" && idx > 0) {
      [newLayers[idx], newLayers[idx - 1]] = [newLayers[idx - 1], newLayers[idx]];
    }
    reorderLayers([...otherLayers, ...newLayers]);
    const socket = getSocket();
    socket.emit("layer:reorder", roomId, [...otherLayers, ...newLayers]);
  };

  const handleSetActive = (layerId: string) => {
    const layer = layers.find((l) => l.id === layerId);
    if (layer?.userId === userId) {
      setActiveLayerId(layerId);
    }
  };

  const handleClearLayer = (layerId: string) => {
    if (!roomId) return;
    clearLayerOperations(layerId);
    const socket = getSocket();
    socket.emit("layer:clear", roomId, layerId);
  };

  return (
    <div className="w-56 bg-white/80 backdrop-blur-xl border-l border-gray-200/60 flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">图层</span>
        <button
          onClick={handleAddLayer}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-[#ff6b35] transition-colors"
          title="新建图层"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {[...myLayers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => handleSetActive(layer.id)}
            className={`px-2 py-1.5 cursor-pointer border-l-2 transition-colors ${
              activeLayerId === layer.id
                ? "border-[#ff6b35] bg-[#ff6b35]/5"
                : "border-transparent hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleVisible(layer);
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <span className="flex-1 text-xs text-gray-700 truncate">{layer.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveLayer(layer.id, "up");
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveLayer(layer.id, "down");
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearLayer(layer.id);
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500"
                title="清空图层"
              >
                <Type size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteLayer(layer.id);
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 disabled:opacity-30"
                disabled={myLayers.length <= 1}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {otherLayers.length > 0 && (
          <>
            <div className="px-2 py-1 text-[10px] text-gray-400 border-t border-gray-100 mt-2">
              其他用户图层
            </div>
            {otherLayers.map((layer) => (
              <div
                key={layer.id}
                className="px-2 py-1.5 border-l-2 border-transparent opacity-60"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 flex items-center justify-center text-gray-300">
                    <Eye size={14} />
                  </span>
                  <span className="flex-1 text-xs text-gray-500 truncate">{layer.name}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
