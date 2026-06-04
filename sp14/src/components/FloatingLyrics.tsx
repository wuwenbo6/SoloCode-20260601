import { useEffect, useState, useRef, useCallback } from "react";
import { usePlayerStore } from "../stores/usePlayerStore";
import { parseLrc, findCurrentLine } from "../utils/lrcParser";
import { readTextFileAutoEncoding } from "../utils/encoding";
import type { LrcLine } from "../stores/usePlayerStore";

export default function FloatingLyrics() {
  const floatingOpen = usePlayerStore((s) => s.floatingOpen);
  const setFloatingOpen = usePlayerStore((s) => s.setFloatingOpen);
  const floatingOpacity = usePlayerStore((s) => s.floatingOpacity);
  const setFloatingOpacity = usePlayerStore((s) => s.setFloatingOpacity);
  const floatingFontSize = usePlayerStore((s) => s.floatingFontSize);
  const setFloatingFontSize = usePlayerStore((s) => s.setFloatingFontSize);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);

  const [lines, setLines] = useState<LrcLine[]>([]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);

  useEffect(() => {
    if (!floatingOpen || initialized.current) return;
    initialized.current = true;
    const x = Math.max(0, (window.innerWidth - 500) / 2);
    const y = window.innerHeight - 240;
    setPosition({ x, y });
  }, [floatingOpen]);

  useEffect(() => {
    if (!floatingOpen) {
      initialized.current = false;
    }
  }, [floatingOpen]);

  useEffect(() => {
    if (!currentTrack?.path) {
      setLines([]);
      return;
    }
    const lrcPath = currentTrack.path.replace(/\.(mp3|flac|wav)$/i, ".lrc");
    readTextFileAutoEncoding(lrcPath)
      .then((content) => setLines(parseLrc(content)))
      .catch(() => setLines([]));
  }, [currentTrack]);

  const activeIndex = findCurrentLine(lines, currentTime);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const currentLine = activeIndex >= 0 ? lines[activeIndex]?.text : "";
  const nextLine = activeIndex >= 0 && activeIndex + 1 < lines.length ? lines[activeIndex + 1]?.text : "";

  return (
    <>
      <button
        className="ctrl-btn"
        onClick={() => setFloatingOpen(!floatingOpen)}
        title="Floating Lyrics"
        style={{ fontSize: "18px" }}
      >
        🎵
      </button>

      {floatingOpen && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: 500,
            zIndex: 99999,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            cursor: dragging ? "grabbing" : "default",
            userSelect: "none",
          }}
        >
          <div
            style={{
              background: `rgba(18,18,24,${floatingOpacity})`,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              padding: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 12px",
                cursor: "grab",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 1 }}>
                ⠿ DRAG TO MOVE
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>⊕</span>
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.05}
                    value={floatingOpacity}
                    onChange={(e) => setFloatingOpacity(parseFloat(e.target.value))}
                    style={{ width: 50, height: 3, accentColor: "#6c5ce7" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>A</span>
                  <input
                    type="range"
                    min={12}
                    max={32}
                    step={1}
                    value={floatingFontSize}
                    onChange={(e) => setFloatingFontSize(parseInt(e.target.value, 10))}
                    style={{ width: 50, height: 3, accentColor: "#6c5ce7" }}
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFloatingOpen(false);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "0 4px",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 24px 20px", textAlign: "center", minHeight: 80 }}>
              {lines.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                  No lyrics available
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: floatingFontSize,
                      color: "#fff",
                      fontWeight: 600,
                      lineHeight: 1.4,
                      transition: "all 0.3s ease",
                    }}
                  >
                    {currentLine || "· · ·"}
                  </div>
                  <div
                    style={{
                      fontSize: floatingFontSize * 0.72,
                      color: "rgba(255,255,255,0.35)",
                      marginTop: 6,
                      lineHeight: 1.4,
                      transition: "all 0.3s ease",
                    }}
                  >
                    {nextLine}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
