import React, { useRef, useEffect, useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { Note } from '../types';

export const PianoRoll: React.FC = () => {
  const { state, dispatch } = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  const selectedTrack = state.project.tracks.find(t => t.id === state.selectedTrackId);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const midiRange = { start: 21, end: 108 };
    const noteCount = midiRange.end - midiRange.start + 1;
    const noteHeight = height / noteCount;
    const pixelsPerMs = 0.1;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i <= noteCount; i++) {
      const y = i * noteHeight;
      ctx.strokeStyle = '#2a2a4e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const beatMs = 60000 / state.project.bpm;
    for (let t = 0; t < width / pixelsPerMs; t += beatMs) {
      const x = t * pixelsPerMs;
      ctx.strokeStyle = '#3a3a5e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let midi = midiRange.start; midi <= midiRange.end; midi++) {
      const noteIndex = midiRange.end - midi;
      const y = noteIndex * noteHeight;
      const noteName = getNoteName(midi);
      const isBlackKey = noteName.includes('#');

      if (isBlackKey) {
        ctx.fillStyle = '#16162a';
        ctx.fillRect(0, y, 50, noteHeight - 1);
      }

      ctx.fillStyle = isBlackKey ? '#666' : '#888';
      ctx.font = '10px monospace';
      ctx.fillText(noteName, 5, y + noteHeight / 2 + 3);
    }

    if (selectedTrack) {
      selectedTrack.notes.forEach((note) => {
        const noteIndex = midiRange.end - note.midiNumber;
        const y = noteIndex * noteHeight;
        const x = note.startTime * pixelsPerMs + 50;
        const noteWidth = (note.duration || 500) * pixelsPerMs;

        const gradient = ctx.createLinearGradient(x, y, x, y + noteHeight - 2);
        gradient.addColorStop(0, '#4a9eff');
        gradient.addColorStop(1, '#2a7edf');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y + 1, Math.max(10, noteWidth - 2), noteHeight - 3, 2);
        ctx.fill();

        ctx.strokeStyle = '#6ab4ff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }, [dimensions, selectedTrack, state.project.bpm]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedTrack || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const midiRange = { start: 21, end: 108 };
    const noteCount = midiRange.end - midiRange.start + 1;
    const noteHeight = dimensions.height / noteCount;
    const pixelsPerMs = 0.1;

    const noteIndex = Math.floor(y / noteHeight);
    const midiNumber = midiRange.end - noteIndex;

    if (midiNumber >= midiRange.start && midiNumber <= midiRange.end) {
      const startTime = (x - 50) / pixelsPerMs;
      
      const newNote: Note = {
        id: `note-${Date.now()}-${Math.random()}`,
        midiNumber,
        velocity: 80,
        startTime: Math.max(0, startTime),
        endTime: Math.max(0, startTime) + 500,
        duration: 500
      };

      dispatch({
        type: 'ADD_NOTE',
        payload: { trackId: state.selectedTrackId!, note: newNote }
      });
    }
  };

  return (
    <div className="piano-roll-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        onClick={handleCanvasClick}
      />
    </div>
  );
};

function getNoteName(midiNumber: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return `${noteNames[noteIndex]}${octave}`;
}
