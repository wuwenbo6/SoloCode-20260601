import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePlayerStore } from "../stores/usePlayerStore";
import type { Track } from "../stores/usePlayerStore";

interface TagEditorProps {
  open: boolean;
  onClose: () => void;
  track: Track | null;
}

export default function TagEditor({ open, onClose, track }: TagEditorProps) {
  const updateTrackInList = usePlayerStore((s) => s.updateTrackInList);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && track) {
      setTitle(track.title);
      setArtist(track.artist);
      setAlbum(track.album);
      setError(null);
      setSaving(false);
    }
  }, [open, track]);

  if (!open || !track) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke("update_track_tags", {
        path: track.path,
        title,
        artist,
        album,
      });
      updateTrackInList(track.path, title, artist, album);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Edit Tags</div>
        <div className="modal-field">
          <label className="modal-label">Title</label>
          <input
            className="modal-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">Artist</label>
          <input
            className="modal-input"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">Album</label>
          <input
            className="modal-input"
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
          />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="modal-btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
