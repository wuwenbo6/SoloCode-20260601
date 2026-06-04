import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { usePlayerStore } from "../stores/usePlayerStore";
import type { Track } from "../stores/usePlayerStore";
import TagEditor from "./TagEditor";

interface ScanProgress {
  total: number;
  processed: number;
  batch: Track[];
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicLibrary() {
  const {
    tracks,
    setTracks,
    appendTracks,
    currentTrack,
    setCurrentTrack,
    setIsPlaying,
    searchQuery,
    setSearchQuery,
    scanning,
    setScanning,
    scanTotal,
    scanProcessed,
    setScanProgress,
  } = usePlayerStore();

  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);

  useEffect(() => {
    invoke<Track[]>("get_tracks").then(setTracks);
  }, [setTracks]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<ScanProgress>("scan_progress", (event) => {
        const { total, processed, batch } = event.payload;
        setScanProgress(total, processed);
        appendTracks(batch);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [appendTracks, setScanProgress]);

  const handleScanFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    setScanning(true);
    try {
      await invoke("scan_folder", { path: selected });
    } finally {
      setScanning(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const result = await invoke<Track[]>("search_tracks", { query });
      setTracks(result);
    } else {
      invoke<Track[]>("get_tracks").then(setTracks);
    }
  };

  const handleTrackClick = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setEditingTrack(track);
    setTagEditorOpen(true);
  };

  return (
    <div className="library">
      <div className="library-header">
        <button className="scan-btn" onClick={handleScanFolder} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan Folder"}
        </button>
        <input
          className="search-input"
          type="text"
          placeholder="Search tracks..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      <div className="track-count">{tracks.length} tracks</div>
      {scanning && scanTotal > 0 && (
        <div className="scanning-indicator">
          Scanning... {scanProcessed}/{scanTotal} ({Math.round((scanProcessed / scanTotal) * 100)}%)
        </div>
      )}
      {scanning && scanTotal === 0 && (
        <div className="scanning-indicator">Preparing scan...</div>
      )}
      <div className="track-list">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`track-item${currentTrack?.id === track.id ? " active" : ""}`}
            onClick={() => handleTrackClick(track)}
            onContextMenu={(e) => handleContextMenu(e, track)}
          >
            <div className="track-info">
              <div className="track-title">{track.title}</div>
              <div className="track-artist">{track.artist}</div>
            </div>
            <div className="track-meta">
              <span className="track-duration">{formatDuration(track.duration_secs)}</span>
              <span className="track-format">{track.file_format}</span>
            </div>
          </div>
        ))}
      </div>
      <TagEditor
        open={tagEditorOpen}
        onClose={() => setTagEditorOpen(false)}
        track={editingTrack}
      />
    </div>
  );
}
