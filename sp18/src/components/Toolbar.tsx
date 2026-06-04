import {
  Pencil,
  Square,
  Circle,
  Minus,
  Eraser,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Sparkles,
  Download,
} from "lucide-react";
import type { ToolType } from "../../shared/types";
import { useWhiteboardStore } from "@/store/whiteboardStore";
import { getSocket } from "@/hooks/useSocket";
import { exportToPNG, exportToSVG } from "@/utils/canvasRenderer";
import { useState } from "react";
import { AVAILABLE_FONTS } from "../../shared/types";

const TOOLS: { type: ToolType; icon: typeof Pencil; label: string }[] = [
  { type: "pen", icon: Pencil, label: "画笔" },
  { type: "rect", icon: Square, label: "矩形" },
  { type: "circle", icon: Circle, label: "圆形" },
  { type: "line", icon: Minus, label: "线条" },
  { type: "eraser", icon: Eraser, label: "橡皮擦" },
  { type: "text", icon: Type, label: "文字" },
];

const COLORS = [
  "#1a1a2e",
  "#ff6b35",
  "#00c9a7",
  "#845ec2",
  "#d65db1",
  "#e63946",
  "#457b9d",
  "#2a9d8f",
];

export default function Toolbar() {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const {
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    currentLineWidth,
    setCurrentLineWidth,
    currentFontSize,
    setCurrentFontSize,
    currentFontFamily,
    setCurrentFontFamily,
    autoCorrect,
    setAutoCorrect,
    roomId,
    removeOperationById,
    addOperation,
    operations,
    getMyUndoCount,
    getMyRedoCount,
    popMyUndo,
    popMyRedo,
    getSortedOperations,
  } = useWhiteboardStore();

  const handleUndo = () => {
    const opId = popMyUndo();
    if (!opId || !roomId) return;
    removeOperationById(opId);
    const socket = getSocket();
    socket.emit("undo:operation", roomId, opId);
  };

  const handleRedo = () => {
    const opId = popMyRedo();
    if (!opId || !roomId) {
      if (opId) popMyUndo();
      return;
    }
    const op = operations.find((o) => o.id === opId);
    if (!op) return;
    addOperation(op);
    const socket = getSocket();
    socket.emit("redo:operation", roomId, op);
  };

  const handleClear = () => {
    if (!roomId) return;
    const socket = getSocket();
    socket.emit("canvas:clear", roomId);
  };

  const handleExportPNG = () => {
    const sortedOps = getSortedOperations();
    const dataUrl = exportToPNG(sortedOps, 1920, 1080);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `SyncBoard-${Date.now()}.png`;
    a.click();
    setShowExportMenu(false);
  };

  const handleExportSVG = () => {
    const sortedOps = getSortedOperations();
    const svg = exportToSVG(sortedOps, 1920, 1080);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SyncBoard-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-white/80 backdrop-blur-xl border-r border-gray-200/60 w-14">
      {TOOLS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => setCurrentTool(type)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
            currentTool === type
              ? "bg-[#ff6b35] text-white shadow-lg shadow-[#ff6b35]/30 scale-110"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
          title={label}
        >
          <Icon size={18} />
        </button>
      ))}

      <div className="w-8 h-px bg-gray-200 my-1" />

      <div className="flex flex-col gap-1.5 items-center">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => setCurrentColor(color)}
            className={`w-6 h-6 rounded-full transition-all duration-200 ${
              currentColor === color
                ? "ring-2 ring-offset-2 ring-[#ff6b35] scale-110"
                : "hover:scale-110"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <div className="w-8 h-px bg-gray-200 my-1" />

      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-400 font-mono">{currentLineWidth}px</span>
        <input
          type="range"
          min="1"
          max="20"
          value={currentLineWidth}
          onChange={(e) => setCurrentLineWidth(Number(e.target.value))}
          className="w-10 -rotate-90 origin-center accent-[#ff6b35]"
        />
      </div>

      {currentTool === "text" && (
        <>
          <div className="w-8 h-px bg-gray-200 my-1" />
          <div className="flex flex-col items-center gap-1 w-full">
            <span className="text-[10px] text-gray-400 font-mono">{currentFontSize}px</span>
            <input
              type="range"
              min="8"
              max="72"
              value={currentFontSize}
              onChange={(e) => setCurrentFontSize(Number(e.target.value))}
              className="w-10 -rotate-90 origin-center accent-[#ff6b35]"
            />
          </div>
          <select
            value={currentFontFamily}
            onChange={(e) => setCurrentFontFamily(e.target.value)}
            className="w-full mt-1 px-1 py-0.5 text-[10px] bg-gray-100 rounded border-none outline-none"
          >
            {AVAILABLE_FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="w-8 h-px bg-gray-200 my-1" />

      <button
        onClick={() => setAutoCorrect(!autoCorrect)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
          autoCorrect
            ? "bg-[#ff6b35]/10 text-[#ff6b35]"
            : "text-gray-400 hover:bg-gray-100"
        }`}
        title="图形自动修正"
      >
        <Sparkles size={18} />
      </button>

      <button
        onClick={handleUndo}
        disabled={getMyUndoCount() === 0}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        title="撤销"
      >
        <Undo2 size={18} />
      </button>

      <button
        onClick={handleRedo}
        disabled={getMyRedoCount() === 0}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        title="重做"
      >
        <Redo2 size={18} />
      </button>

      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-200"
          title="导出"
        >
          <Download size={18} />
        </button>
        {showExportMenu && (
          <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[120px]">
            <button
              onClick={handleExportPNG}
              className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
            >
              导出 PNG
            </button>
            <button
              onClick={handleExportSVG}
              className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
            >
              导出 SVG
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleClear}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
        title="清空画布"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
