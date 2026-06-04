import { create } from "zustand";

export interface Track {
  id: number;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration_secs: number;
  file_format: string;
}

export type PlayMode = "sequential" | "loop" | "shuffle";

export interface LrcLine {
  time: number;
  text: string;
}

const STORAGE_KEYS = {
  volume: "melodybox-volume",
  lastTrackId: "melodybox-last-track-id",
  lastPosition: "melodybox-last-position",
  playMode: "melodybox-play-mode",
  floatingOpacity: "melodybox-floating-opacity",
  floatingFontSize: "melodybox-floating-font-size",
  floatingOpen: "melodybox-floating-open",
};

function loadNumber(key: string, fallback: number): number {
  const v = localStorage.getItem(key);
  return v !== null ? parseFloat(v) : fallback;
}

function loadString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}

interface PlayerState {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playMode: PlayMode;
  searchQuery: string;
  scanning: boolean;
  scanTotal: number;
  scanProcessed: number;
  floatingOpen: boolean;
  floatingOpacity: number;
  floatingFontSize: number;

  setTracks: (tracks: Track[]) => void;
  appendTracks: (tracks: Track[]) => void;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  setSearchQuery: (query: string) => void;
  setScanning: (scanning: boolean) => void;
  setScanProgress: (total: number, processed: number) => void;
  setFloatingOpen: (open: boolean) => void;
  setFloatingOpacity: (opacity: number) => void;
  setFloatingFontSize: (size: number) => void;
  updateTrackInList: (path: string, title: string, artist: string, album: string) => void;
  playNext: () => void;
  playPrev: () => void;
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  tracks: [],
  currentTrack: null,
  isPlaying: false,
  volume: loadNumber(STORAGE_KEYS.volume, 0.8),
  currentTime: 0,
  duration: 0,
  playMode: loadString(STORAGE_KEYS.playMode, "sequential") as PlayMode,
  searchQuery: "",
  scanning: false,
  scanTotal: 0,
  scanProcessed: 0,
  floatingOpen: localStorage.getItem(STORAGE_KEYS.floatingOpen) === "true",
  floatingOpacity: loadNumber(STORAGE_KEYS.floatingOpacity, 0.85),
  floatingFontSize: loadNumber(STORAGE_KEYS.floatingFontSize, 18),

  setTracks: (tracks) => set({ tracks }),
  appendTracks: (newTracks) =>
    set((state) => {
      const existingPaths = new Set(state.tracks.map((t) => t.path));
      const uniqueNew = newTracks.filter((t) => !existingPaths.has(t.path));
      return { tracks: [...state.tracks, ...uniqueNew] };
    }),
  setCurrentTrack: (track) => {
    if (track) {
      localStorage.setItem(STORAGE_KEYS.lastTrackId, String(track.id));
    }
    set({ currentTrack: track });
  },
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => {
    localStorage.setItem(STORAGE_KEYS.volume, String(volume));
    set({ volume });
  },
  setCurrentTime: (time) => {
    const state = get();
    if (state.currentTrack) {
      localStorage.setItem(STORAGE_KEYS.lastPosition, String(time));
    }
    set({ currentTime: time });
  },
  setDuration: (duration) => set({ duration }),
  setPlayMode: (mode) => {
    localStorage.setItem(STORAGE_KEYS.playMode, mode);
    set({ playMode: mode });
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setScanning: (scanning) => set({ scanning, scanTotal: scanning ? 0 : 0, scanProcessed: scanning ? 0 : 0 }),
  setScanProgress: (total, processed) => set({ scanTotal: total, scanProcessed: processed }),
  setFloatingOpen: (open) => {
    localStorage.setItem(STORAGE_KEYS.floatingOpen, String(open));
    set({ floatingOpen: open });
  },
  setFloatingOpacity: (opacity) => {
    localStorage.setItem(STORAGE_KEYS.floatingOpacity, String(opacity));
    set({ floatingOpacity: opacity });
  },
  setFloatingFontSize: (size) => {
    localStorage.setItem(STORAGE_KEYS.floatingFontSize, String(size));
    set({ floatingFontSize: size });
  },
  updateTrackInList: (path, title, artist, album) =>
    set((state) => {
      const tracks = state.tracks.map((t) =>
        t.path === path ? { ...t, title, artist, album } : t
      );
      const currentTrack =
        state.currentTrack?.path === path
          ? { ...state.currentTrack, title, artist, album }
          : state.currentTrack;
      return { tracks, currentTrack };
    }),

  playNext: () => {
    const { tracks, currentTrack, playMode } = get();
    if (tracks.length === 0) return;
    if (playMode === "shuffle") {
      const idx = Math.floor(Math.random() * tracks.length);
      set({ currentTrack: tracks[idx], currentTime: 0 });
      return;
    }
    const currentIdx = currentTrack
      ? tracks.findIndex((t) => t.id === currentTrack.id)
      : -1;
    const nextIdx = (currentIdx + 1) % tracks.length;
    set({ currentTrack: tracks[nextIdx], currentTime: 0 });
  },

  playPrev: () => {
    const { tracks, currentTrack } = get();
    if (tracks.length === 0) return;
    const currentIdx = currentTrack
      ? tracks.findIndex((t) => t.id === currentTrack.id)
      : 0;
    const prevIdx = (currentIdx - 1 + tracks.length) % tracks.length;
    set({ currentTrack: tracks[prevIdx], currentTime: 0 });
  },
}));
