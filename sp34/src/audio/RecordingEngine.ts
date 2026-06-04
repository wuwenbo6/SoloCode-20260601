import { Note, Track, QuantizationValue } from '../types';
import { audioEngine } from './AudioEngine';

export class RecordingEngine {
  private isRecording = false;
  private isPlaying = false;
  private recordingStartTimeAudio = 0;
  private playbackStartTime = 0;
  private activeNotes: Map<number, Note> = new Map();
  private currentTrackId: string | null = null;
  private bpm = 120;
  private quantization: QuantizationValue = 16;
  private playbackFrameId: number | null = null;
  private scheduledNoteIds: Map<string, number> = new Map();

  setBPM(bpm: number) {
    this.bpm = bpm;
  }

  setQuantization(value: QuantizationValue) {
    this.quantization = value;
  }

  getQuantization(): QuantizationValue {
    return this.quantization;
  }

  startRecording(trackId: string) {
    if (this.isRecording) return;

    this.isRecording = true;
    this.currentTrackId = trackId;
    this.recordingStartTimeAudio = audioEngine.getCurrentTime();
    this.activeNotes.clear();
  }

  stopRecording(): Note[] {
    if (!this.isRecording) return [];

    this.isRecording = false;
    const recordedNotes: Note[] = [];
    const currentAudioTime = audioEngine.getCurrentTime();

    this.activeNotes.forEach((note) => {
      if (note.endTime === null) {
        note.endTime = (currentAudioTime - this.recordingStartTimeAudio) * 1000;
      }
      note.duration = note.endTime - note.startTime;
      recordedNotes.push(this.quantizeNote(note));
    });

    this.activeNotes.clear();
    this.currentTrackId = null;

    return recordedNotes;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  recordNoteOn(midiNumber: number, velocity: number, audioTime?: number): Note | null {
    if (!this.isRecording || !this.currentTrackId) return null;

    const effectiveTime = audioTime !== undefined
      ? audioTime
      : audioEngine.getCurrentTime();
    
    const startTimeMs = (effectiveTime - this.recordingStartTimeAudio) * 1000;

    const note: Note = {
      id: `${midiNumber}-${Date.now()}-${Math.random()}`,
      midiNumber,
      velocity,
      startTime: Math.max(0, startTimeMs),
      endTime: null
    };

    this.activeNotes.set(midiNumber, note);
    return note;
  }

  recordNoteOff(midiNumber: number, audioTime?: number): Note | null {
    if (!this.isRecording || !this.currentTrackId) return null;

    const note = this.activeNotes.get(midiNumber);
    if (note) {
      const effectiveTime = audioTime !== undefined
        ? audioTime
        : audioEngine.getCurrentTime();

      note.endTime = Math.max(note.startTime + 1, (effectiveTime - this.recordingStartTimeAudio) * 1000);
      note.duration = note.endTime - note.startTime;
      this.activeNotes.delete(midiNumber);
      return this.quantizeNote(note);
    }

    return null;
  }

  private quantizeNote(note: Note): Note {
    const gridMs = this.getGridMilliseconds();
    const quantizedStart = Math.round(note.startTime / gridMs) * gridMs;
    const quantizedDuration = Math.max(
      gridMs / 2,
      Math.round((note.duration || 0) / gridMs) * gridMs
    );

    return {
      ...note,
      startTime: quantizedStart,
      endTime: quantizedStart + quantizedDuration,
      duration: quantizedDuration
    };
  }

  quantizeNotes(notes: Note[]): Note[] {
    return notes.map(note => this.quantizeNote(note));
  }

  private getGridMilliseconds(): number {
    const beatMs = 60000 / this.bpm;
    const beatDivisions: Record<QuantizationValue, number> = {
      1: 4,
      2: 2,
      4: 1,
      8: 0.5,
      16: 0.25,
      32: 0.125
    };
    return beatMs * beatDivisions[this.quantization];
  }

  alignToGrid(timeMs: number): number {
    const gridMs = this.getGridMilliseconds();
    return Math.round(timeMs / gridMs) * gridMs;
  }

  startPlayback(track: Track, onNote?: (note: Note) => void, onComplete?: () => void) {
    if (this.isPlaying) return;

    this.isPlaying = true;
    const audioNow = audioEngine.getCurrentTime();
    this.playbackStartTime = audioNow;
    this.scheduledNoteIds.clear();

    const sortedNotes = [...track.notes].sort((a, b) => a.startTime - b.startTime);

    if (sortedNotes.length === 0) {
      this.isPlaying = false;
      onComplete?.();
      return;
    }

    const lookaheadMs = 200;
    const scheduleIntervalMs = 25;

    const scheduleNotes = () => {
      if (!this.isPlaying) return;

      const currentAudioTime = audioEngine.getCurrentTime();
      const elapsedMs = (currentAudioTime - this.playbackStartTime) * 1000;
      const lookaheadBoundary = elapsedMs + lookaheadMs;

      sortedNotes.forEach((note) => {
        if (!this.scheduledNoteIds.has(note.id)) {
          if (note.startTime <= lookaheadBoundary) {
            const noteAudioStartTime = this.playbackStartTime + note.startTime / 1000;
            
            audioEngine.playScheduledNote(
              note,
              noteAudioStartTime,
              track.id
            );

            this.scheduledNoteIds.set(note.id, note.startTime);

            if (note.startTime <= elapsedMs) {
              onNote?.(note);
            }
          }
        }
      });

      const lastNote = sortedNotes[sortedNotes.length - 1];
      const totalDuration = (lastNote.startTime + (lastNote.duration || 0));

      if (elapsedMs >= totalDuration + 500) {
        this.stopPlayback();
        onComplete?.();
        return;
      }

      this.playbackFrameId = window.setTimeout(scheduleNotes, scheduleIntervalMs);
    };

    scheduleNotes();
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.playbackFrameId !== null) {
      clearTimeout(this.playbackFrameId);
      this.playbackFrameId = null;
    }
    this.scheduledNoteIds.clear();
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  dispose() {
    this.stopPlayback();
    this.activeNotes.clear();
    this.scheduledNoteIds.clear();
  }
}

export const recordingEngine = new RecordingEngine();
