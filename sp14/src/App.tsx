import { useRef } from "react";
import MusicLibrary from "./components/MusicLibrary";
import PlayerControls from "./components/PlayerControls";
import LyricsDisplay from "./components/LyricsDisplay";
import SpectrumVisualizer from "./components/SpectrumVisualizer";
import FloatingLyrics from "./components/FloatingLyrics";
import "./App.css";

function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  return (
    <div className="app">
      <div className="main-content">
        <div className="left-panel">
          <MusicLibrary />
        </div>
        <div className="right-panel">
          <SpectrumVisualizer analyserRef={analyserRef} />
          <LyricsDisplay />
        </div>
      </div>
      <PlayerControls
        audioRef={audioRef}
        audioCtxRef={audioCtxRef}
        analyserRef={analyserRef}
        sourceRef={sourceRef}
        floatingLyricsSlot={<FloatingLyrics />}
      />
      <audio ref={audioRef} preload="auto" />
    </div>
  );
}

export default App;
