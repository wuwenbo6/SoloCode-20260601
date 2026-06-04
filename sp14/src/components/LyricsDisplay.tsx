import { useEffect, useState, useRef } from "react";
import { usePlayerStore } from "../stores/usePlayerStore";
import { parseLrc, findCurrentLine } from "../utils/lrcParser";
import { readTextFileAutoEncoding } from "../utils/encoding";
import type { LrcLine } from "../stores/usePlayerStore";
import LyricsSearch from "./LyricsSearch";

export default function LyricsDisplay() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const [lines, setLines] = useState<LrcLine[]>([]);
  const [lrcExists, setLrcExists] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);

  const loadLyrics = () => {
    if (!currentTrack?.path) {
      setLines([]);
      setLrcExists(false);
      return;
    }
    const lrcPath = currentTrack.path.replace(/\.(mp3|flac|wav)$/i, ".lrc");
    readTextFileAutoEncoding(lrcPath)
      .then((content) => {
        setLines(parseLrc(content));
        setLrcExists(true);
      })
      .catch(() => {
        setLines([]);
        setLrcExists(false);
      });
  };

  useEffect(() => {
    loadLyrics();
  }, [currentTrack]);

  const activeIndex = findCurrentLine(lines, currentTime);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const handleLyricsSaved = () => {
    setSearchOpen(false);
    loadLyrics();
  };

  return (
    <>
      <div className="lyrics-section">
        <div className="lyrics-header">
          <span className="lyrics-label">Lyrics</span>
          {!lrcExists && currentTrack && (
            <button
              className="lyrics-search-btn"
              onClick={() => setSearchOpen(true)}
            >
              🔍 Search Online
            </button>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="no-lyrics">
            {currentTrack ? "No lyrics available" : "No track selected"}
          </div>
        ) : (
          <div className="lyrics-container">
            {lines.map((line, i) => (
              <div
                key={i}
                ref={i === activeIndex ? activeRef : undefined}
                className={`lyric-line${i === activeIndex ? " active" : ""}`}
              >
                {line.text}
              </div>
            ))}
          </div>
        )}
      </div>
      <LyricsSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onLyricsSaved={handleLyricsSaved}
      />
    </>
  );
}
