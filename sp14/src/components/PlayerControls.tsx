import { useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { usePlayerStore } from "../stores/usePlayerStore";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface PlayerControlsProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioCtxRef: React.RefObject<AudioContext | null>;
  analyserRef: React.RefObject<AnalyserNode | null>;
  sourceRef: React.RefObject<MediaElementAudioSourceNode | null>;
  floatingLyricsSlot: React.ReactNode;
}

export default function PlayerControls({
  audioRef,
  audioCtxRef,
  analyserRef,
  sourceRef,
  floatingLyricsSlot,
}: PlayerControlsProps) {
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playMode,
    setPlayMode,
    playNext,
    playPrev,
  } = usePlayerStore();

  const sourceCreatedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.src = convertFileSrc(currentTrack.path);
    audio.volume = volume;
    audio.load();
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!sourceCreatedRef.current) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      sourceCreatedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (playMode === "loop") {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [playMode]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const cyclePlayMode = () => {
    const modes: Array<"sequential" | "loop" | "shuffle"> = [
      "sequential",
      "loop",
      "shuffle",
    ];
    const idx = modes.indexOf(playMode);
    setPlayMode(modes[(idx + 1) % modes.length]);
  };

  const modeSymbol =
    playMode === "sequential" ? "➡️" : playMode === "loop" ? "🔁" : "🔀";

  return (
    <div className="player-controls">
      <div className="player-info">
        <div className="track-title">{currentTrack?.title ?? "—"}</div>
        <div className="track-artist">{currentTrack?.artist ?? "—"}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="ctrl-btn" onClick={playPrev}>⏮</button>
          <button className="play-btn" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button className="ctrl-btn" onClick={playNext}>⏭</button>
        </div>

        <div className="progress-section">
          <span className="time-display">{formatTime(currentTime)}</span>
          <input
            className="progress-bar"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
          />
          <span className="time-display">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="volume-section">
        <span>🔊</span>
        <input
          className="volume-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
        />
      </div>

      <button className="mode-btn" onClick={cyclePlayMode}>
        {modeSymbol}
      </button>

      {floatingLyricsSlot}
    </div>
  );
}
