import { useRef, useEffect, useCallback, useState } from "react";
import type { ToolType, DrawOperation, Point } from "../../shared/types";
import { generateId } from "../../shared/types";
import { useWhiteboardStore } from "@/store/whiteboardStore";
import { recognizeShape } from "@/utils/shapeRecognition";
import { redrawAll, drawOperation } from "@/utils/canvasRenderer";
import { getSocket } from "@/hooks/useSocket";

const TOOL_CURSORS: Record<ToolType, string> = {
  pen: "crosshair",
  rect: "crosshair",
  circle: "crosshair",
  line: "crosshair",
  eraser: "cell",
  text: "text",
};

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [textInputPos, setTextInputPos] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState("");
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const scaleRef = useRef(1);
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const lastTouchDistRef = useRef(0);
  const lastTouchCenterRef = useRef<Point>({ x: 0, y: 0 });
  const touchCountRef = useRef(0);

  const {
    roomId,
    userId,
    currentTool,
    currentColor,
    currentLineWidth,
    currentFontSize,
    currentFontFamily,
    activeLayerId,
    operations,
    autoCorrect,
    addOperation,
    pushMyUndo,
    getSortedOperations,
  } = useWhiteboardStore();

  const getCanvasCoords = useCallback((e: MouseEvent | Touch): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offsetXRef.current) / scaleRef.current,
      y: (e.clientY - rect.top - offsetYRef.current) / scaleRef.current,
    };
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sortedOps = getSortedOperations();
    redrawAll(ctx, sortedOps, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), offsetXRef.current, offsetYRef.current, scaleRef.current);
  }, [getSortedOperations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      redraw();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const emitCursor = useCallback(
    (x: number, y: number) => {
      if (!roomId) return;
      const socket = getSocket();
      socket.emit("cursor:move", { userId, roomId, x, y });
    },
    [roomId, userId]
  );

  const createTextOperation = useCallback(
    (pos: Point, content: string) => {
      const op: DrawOperation = {
        id: generateId(),
        type: "text",
        userId,
        roomId: roomId || "",
        layerId: activeLayerId,
        points: [pos],
        color: currentColor,
        lineWidth: currentLineWidth,
        timestamp: Date.now(),
        text: {
          content,
          fontSize: currentFontSize,
          fontFamily: currentFontFamily,
        },
      };
      addOperation(op);
      pushMyUndo(op.id);
      if (roomId) {
        const socket = getSocket();
        socket.emit("draw:operation", op);
      }
    },
    [userId, roomId, activeLayerId, currentColor, currentLineWidth, currentFontSize, currentFontFamily, addOperation, pushMyUndo]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (touchCountRef.current > 0) return;
      if (currentTool === "text") {
        const pos = getCanvasCoords(e);
        setTextInputPos({ x: e.clientX, y: e.clientY });
        setTextValue("");
        setTimeout(() => textInputRef.current?.focus(), 0);
        return;
      }
      isDrawingRef.current = true;
      const pt = getCanvasCoords(e);
      pointsRef.current = [pt];
      const ctx = canvas.getContext("2d");
      if (ctx && (currentTool === "pen" || currentTool === "eraser")) {
        ctx.save();
        ctx.translate(offsetXRef.current, offsetYRef.current);
        ctx.scale(scaleRef.current, scaleRef.current);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.restore();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pt = getCanvasCoords(e);
      emitCursor(pt.x, pt.y);

      if (!isDrawingRef.current) return;
      pointsRef.current.push(pt);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      redraw();

      const tempOp: DrawOperation = {
        id: "temp",
        type: currentTool,
        userId,
        roomId: roomId || "",
        layerId: activeLayerId,
        points: [...pointsRef.current],
        color: currentColor,
        lineWidth: currentTool === "eraser" ? currentLineWidth * 3 : currentLineWidth,
        timestamp: Date.now(),
      };
      drawOperation(ctx, tempOp, offsetXRef.current, offsetYRef.current, scaleRef.current);
    };

    const handleMouseUp = async () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (pointsRef.current.length < 2) return;

      const corrected = currentTool === "pen" && autoCorrect
        ? (await recognizeShape(pointsRef.current, autoCorrect)) ?? undefined
        : undefined;

      const op: DrawOperation = {
        id: generateId(),
        type: currentTool,
        userId,
        roomId: roomId || "",
        layerId: activeLayerId,
        points: [...pointsRef.current],
        color: currentColor,
        lineWidth: currentTool === "eraser" ? currentLineWidth * 3 : currentLineWidth,
        timestamp: Date.now(),
        corrected,
      };

      addOperation(op);
      pushMyUndo(op.id);

      if (roomId) {
        const socket = getSocket();
        socket.emit("draw:operation", op);
      }

      pointsRef.current = [];
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01;
        const newScale = Math.min(5, Math.max(0.1, scaleRef.current * (1 + delta)));
        scaleRef.current = newScale;
      } else {
        offsetXRef.current -= e.deltaX;
        offsetYRef.current -= e.deltaY;
      }
      redraw();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [currentTool, currentColor, currentLineWidth, currentFontSize, currentFontFamily, roomId, userId, activeLayerId, autoCorrect, redraw, getCanvasCoords, emitCursor, addOperation, pushMyUndo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        lastTouchDistRef.current = Math.sqrt(dx * dx + dy * dy);
        lastTouchCenterRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        isDrawingRef.current = false;
      } else if (e.touches.length === 1) {
        isDrawingRef.current = true;
        const pt = getCanvasCoords(e.touches[0]);
        pointsRef.current = [pt];
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };

        if (lastTouchDistRef.current > 0) {
          const scaleDelta = dist / lastTouchDistRef.current;
          const newScale = Math.min(5, Math.max(0.1, scaleRef.current * scaleDelta));
          scaleRef.current = newScale;

          offsetXRef.current += center.x - lastTouchCenterRef.current.x;
          offsetYRef.current += center.y - lastTouchCenterRef.current.y;
        }

        lastTouchDistRef.current = dist;
        lastTouchCenterRef.current = center;
        redraw();
      } else if (e.touches.length === 1 && isDrawingRef.current) {
        const pt = getCanvasCoords(e.touches[0]);
        pointsRef.current.push(pt);
        emitCursor(pt.x, pt.y);
        redraw();
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const tempOp: DrawOperation = {
          id: "temp",
          type: currentTool,
          userId,
          roomId: roomId || "",
          layerId: activeLayerId,
          points: [...pointsRef.current],
          color: currentColor,
          lineWidth: currentTool === "eraser" ? currentLineWidth * 3 : currentLineWidth,
          timestamp: Date.now(),
        };
        drawOperation(ctx, tempOp, offsetXRef.current, offsetYRef.current, scaleRef.current);
      }
    };

    const handleTouchEnd = async (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 0) {
        if (isDrawingRef.current && pointsRef.current.length >= 2) {
          const corrected = currentTool === "pen" && autoCorrect
            ? (await recognizeShape(pointsRef.current, autoCorrect)) ?? undefined
            : undefined;

          const op: DrawOperation = {
            id: generateId(),
            type: currentTool,
            userId,
            roomId: roomId || "",
            layerId: activeLayerId,
            points: [...pointsRef.current],
            color: currentColor,
            lineWidth: currentTool === "eraser" ? currentLineWidth * 3 : currentLineWidth,
            timestamp: Date.now(),
            corrected,
          };
          addOperation(op);
          pushMyUndo(op.id);
          if (roomId) {
            const socket = getSocket();
            socket.emit("draw:operation", op);
          }
        }
        isDrawingRef.current = false;
        pointsRef.current = [];
        lastTouchDistRef.current = 0;
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentTool, currentColor, currentLineWidth, roomId, userId, activeLayerId, autoCorrect, redraw, getCanvasCoords, emitCursor, addOperation, pushMyUndo]);

  const handleTextBlur = () => {
    if (textValue.trim() && textInputPos) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const canvasX = (textInputPos.x - rect.left - offsetXRef.current) / scaleRef.current;
      const canvasY = (textInputPos.y - rect.top - offsetYRef.current) / scaleRef.current;
      createTextOperation({ x: canvasX, y: canvasY }, textValue.trim());
    }
    setTextInputPos(null);
    setTextValue("");
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTextBlur();
    } else if (e.key === "Escape") {
      setTextInputPos(null);
      setTextValue("");
    }
  };

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: TOOL_CURSORS[currentTool] || "crosshair", touchAction: "none" }}
      />
      {textInputPos && (
        <input
          ref={textInputRef}
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          className="absolute z-20 px-1 py-0.5 bg-white border border-[#ff6b35] outline-none rounded shadow-lg"
          style={{
            left: textInputPos.x,
            top: textInputPos.y,
            fontSize: `${currentFontSize}px`,
            fontFamily: currentFontFamily,
            color: currentColor,
            minWidth: "100px",
            transform: "translate(4px, -16px)",
          }}
          placeholder="输入文字..."
        />
      )}
    </div>
  );
}
