import { audioEngine } from './AudioEngine';

export class Metronome {
  private isRunning = false;
  private bpm = 120;
  private volume = 0.5;
  private accentFirstBeat = true;
  private currentBeat = 0;
  private nextNoteTime = 0;
  private timerWorker: Worker | null = null;

  constructor() {
    this.setupTimer();
  }

  private setupTimer() {
    const timerCode = `
      let timerID = null;
      let interval = 200;

      self.onmessage = function(e) {
        if (e.data === 'start') {
          timerID = setInterval(function() {
            postMessage('tick');
          }, interval);
        } else if (e.data === 'stop') {
          clearInterval(timerID);
          timerID = null;
        } else if (e.data.interval) {
          interval = e.data.interval;
          if (timerID) {
            clearInterval(timerID);
            timerID = setInterval(function() {
              postMessage('tick');
            }, interval);
          }
        }
      };
    `;

    const blob = new Blob([timerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.timerWorker = new Worker(workerUrl);

    this.timerWorker.onmessage = (e) => {
      if (e.data === 'tick' && this.isRunning) {
        this.scheduleBeats();
      }
    };
  }

  private scheduleBeats() {
    const secondsPerBeat = 60.0 / this.bpm;
    const scheduleAheadTime = 0.1;

    while (this.nextNoteTime < audioEngine.getCurrentTime() + scheduleAheadTime) {
      this.playClick(this.nextNoteTime, this.currentBeat === 0);
      
      this.nextNoteTime += secondsPerBeat;
      this.currentBeat = (this.currentBeat + 1) % 4;
    }
  }

  private playClick(time: number, isAccent: boolean) {
    const context = audioEngine.getContext();
    if (!context) return;

    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.connect(gain);
    gain.connect(context.destination);

    osc.frequency.value = isAccent && this.accentFirstBeat ? 1000 : 800;

    const clickVolume = this.volume * (isAccent ? 1.0 : 0.7);
    gain.gain.setValueAtTime(clickVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentBeat = 0;
    this.nextNoteTime = audioEngine.getCurrentTime();
    this.timerWorker?.postMessage('start');
  }

  stop() {
    this.isRunning = false;
    this.timerWorker?.postMessage('stop');
  }

  toggle(): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  setBPM(bpm: number) {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  getBPM(): number {
    return this.bpm;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }

  setAccentFirstBeat(accent: boolean) {
    this.accentFirstBeat = accent;
  }

  getAccentFirstBeat(): boolean {
    return this.accentFirstBeat;
  }

  getCurrentBeat(): number {
    return this.currentBeat;
  }

  isPlaying(): boolean {
    return this.isRunning;
  }

  dispose() {
    this.stop();
    this.timerWorker?.terminate();
  }
}

export const metronome = new Metronome();
