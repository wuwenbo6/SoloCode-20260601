import { MouseTrajectoryPoint, ForceRecording, RecordingState, PresetParams } from '../types';

export class ForceRecorder {
  private recordingState: RecordingState = 'idle';
  private points: MouseTrajectoryPoint[] = [];
  private startTime: number = 0;
  private currentPlaybackIndex: number = 0;
  private playbackStartTime: number = 0;
  private currentRecording: ForceRecording | null = null;
  private recordings: ForceRecording[] = [];
  private playbackSpeed: number = 1.0;
  private onPlaybackFrame?: (point: MouseTrajectoryPoint | null) => void;
  private playbackFrameId: number | null = null;

  public setStateCallback(callback: (point: MouseTrajectoryPoint | null) => void): void {
    this.onPlaybackFrame = callback;
  }

  public startRecording(initialParams: PresetParams, particleCount: number): void {
    this.stopPlayback();
    this.recordingState = 'recording';
    this.points = [];
    this.startTime = performance.now();
    this.currentRecording = {
      id: '',
      name: '',
      createdAt: Date.now(),
      duration: 0,
      points: [],
      particleCount,
      params: { ...initialParams },
    };
  }

  public recordMousePosition(x: number, y: number, strength: number = 1.0): void {
    if (this.recordingState !== 'recording') return;

    const timestamp = performance.now() - this.startTime;
    this.points.push({ x, y, timestamp, strength });
  }

  public stopRecording(): ForceRecording | null {
    if (this.recordingState !== 'recording') return null;

    this.recordingState = 'idle';
    const duration = performance.now() - this.startTime;

    this.currentRecording = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      name: `录制 ${new Date().toLocaleTimeString()}`,
      createdAt: Date.now(),
      duration,
      points: [...this.points],
      particleCount: this.currentRecording?.particleCount || 0,
      params: this.currentRecording?.params || {} as PresetParams,
    };

    this.recordings.push(this.currentRecording);
    return this.currentRecording;
  }

  public startPlayback(recording: ForceRecording, loop: boolean = true): void {
    this.stopPlayback();
    this.currentRecording = recording;
    this.recordingState = 'playing';
    this.currentPlaybackIndex = 0;
    this.playbackStartTime = performance.now();

    this.runPlayback(loop);
  }

  private runPlayback(loop: boolean): void {
    if (this.recordingState !== 'playing' || !this.currentRecording) return;

    const elapsed = (performance.now() - this.playbackStartTime) * this.playbackSpeed;
    const recording = this.currentRecording;

    if (elapsed >= recording.duration) {
      if (loop) {
        this.playbackStartTime = performance.now();
        this.currentPlaybackIndex = 0;
      } else {
        this.stopPlayback();
        return;
      }
    }

    while (
      this.currentPlaybackIndex < recording.points.length - 1 &&
      recording.points[this.currentPlaybackIndex + 1].timestamp < elapsed
    ) {
      this.currentPlaybackIndex++;
    }

    let playbackPoint: MouseTrajectoryPoint | null = null;

    if (this.currentPlaybackIndex < recording.points.length) {
      const current = recording.points[this.currentPlaybackIndex];
      const next = recording.points[this.currentPlaybackIndex + 1];

      if (next && next.timestamp !== current.timestamp) {
        const t = (elapsed - current.timestamp) / (next.timestamp - current.timestamp);
        playbackPoint = {
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t,
          timestamp: elapsed,
          strength: current.strength + (next.strength - current.strength) * t,
        };
      } else {
        playbackPoint = { ...current, timestamp: elapsed };
      }
    }

    if (this.onPlaybackFrame && playbackPoint) {
      this.onPlaybackFrame(playbackPoint);
    }

    this.playbackFrameId = requestAnimationFrame(() => this.runPlayback(loop));
  }

  public pausePlayback(): void {
    if (this.recordingState === 'playing') {
      this.recordingState = 'paused';
      if (this.playbackFrameId !== null) {
        cancelAnimationFrame(this.playbackFrameId);
        this.playbackFrameId = null;
      }
    }
  }

  public resumePlayback(loop: boolean = true): void {
    if (this.recordingState === 'paused' && this.currentRecording) {
      this.recordingState = 'playing';
      this.playbackStartTime = performance.now() - (this.playbackStartTime > 0 ? 0 : 0);
      this.runPlayback(loop);
    }
  }

  public stopPlayback(): void {
    this.recordingState = 'idle';
    if (this.playbackFrameId !== null) {
      cancelAnimationFrame(this.playbackFrameId);
      this.playbackFrameId = null;
    }
    if (this.onPlaybackFrame) {
      this.onPlaybackFrame(null);
    }
  }

  public setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
  }

  public getState(): RecordingState {
    return this.recordingState;
  }

  public getRecordings(): ForceRecording[] {
    return [...this.recordings];
  }

  public getCurrentRecording(): ForceRecording | null {
    return this.currentRecording;
  }

  public getRecordingDuration(): number {
    if (this.recordingState === 'recording') {
      return performance.now() - this.startTime;
    }
    return this.currentRecording?.duration || 0;
  }

  public getPlaybackProgress(): number {
    if (!this.currentRecording) return 0;
    const elapsed = (performance.now() - this.playbackStartTime) * this.playbackSpeed;
    return Math.min(elapsed / this.currentRecording.duration, 1.0);
  }

  public deleteRecording(id: string): boolean {
    const index = this.recordings.findIndex(r => r.id === id);
    if (index !== -1) {
      if (this.currentRecording?.id === id) {
        this.stopPlayback();
      }
      this.recordings.splice(index, 1);
      return true;
    }
    return false;
  }

  public renameRecording(id: string, name: string): boolean {
    const recording = this.recordings.find(r => r.id === id);
    if (recording) {
      recording.name = name;
      return true;
    }
    return false;
  }

  public exportRecording(id: string): string | null {
    const recording = this.recordings.find(r => r.id === id);
    if (!recording) return null;
    return JSON.stringify(recording, null, 2);
  }

  public importRecording(json: string): ForceRecording | null {
    try {
      const recording = JSON.parse(json) as ForceRecording;
      if (!recording.id || !recording.points) return null;
      this.recordings.push(recording);
      return recording;
    } catch {
      return null;
    }
  }

  public destroy(): void {
    this.stopPlayback();
    this.recordings = [];
    this.currentRecording = null;
  }
}
