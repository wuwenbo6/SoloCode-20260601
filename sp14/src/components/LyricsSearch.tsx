import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePlayerStore } from "../stores/usePlayerStore";

interface LrcSearchResult {
  id: number;
  title: string;
  artist: string;
}

interface LyricsSearchProps {
  open: boolean;
  onClose: () => void;
  onLyricsSaved: () => void;
}

export default function LyricsSearch({ open, onClose, onLyricsSaved }: LyricsSearchProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [results, setResults] = useState<LrcSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (open && currentTrack) {
      const q = `${currentTrack.title} ${currentTrack.artist}`;
      setSearchInput(q);
      setLoading(true);
      setError(null);
      invoke<LrcSearchResult[]>("search_lyrics", {
        title: currentTrack.title,
        artist: currentTrack.artist,
      })
        .then(setResults)
        .catch((e) => {
          setError(String(e));
          setResults([]);
        })
        .finally(() => setLoading(false));
    }
  }, [open, currentTrack]);

  if (!open) return null;

  const handleSearch = () => {
    const q = searchInput.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    invoke<LrcSearchResult[]>("search_lyrics", { title: q, artist: "" })
      .then(setResults)
      .catch((e) => {
        setError(String(e));
        setResults([]);
      })
      .finally(() => setLoading(false));
  };

  const handleDownload = async (songId: number) => {
    if (!currentTrack) return;
    setDownloadingId(songId);
    setError(null);
    try {
      const savePath = currentTrack.path.replace(/\.(mp3|flac|wav)$/i, ".lrc");
      await invoke("download_lyrics", { songId, savePath });
      onLyricsSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Search Lyrics</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            className="modal-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="modal-btn primary" onClick={handleSearch} disabled={loading}>
            Search
          </button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        {loading && (
          <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)" }}>
            Searching…
          </div>
        )}
        {!loading && results.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)" }}>
            No results found
          </div>
        )}
        {!loading &&
          results.map((r) => (
            <div className="search-row" key={r.id}>
              <div className="search-info">
                <div className="search-title">{r.title}</div>
                <div className="search-artist">{r.artist}</div>
              </div>
              <button
                className="modal-btn primary"
                onClick={() => handleDownload(r.id)}
                disabled={downloadingId !== null}
              >
                {downloadingId === r.id ? "Downloading…" : "Download"}
              </button>
            </div>
          ))}
        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
