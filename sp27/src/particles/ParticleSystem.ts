import { WebGPURenderer } from '../gpu/WebGPURenderer';
import {
  PresetParams,
  DEFAULT_PRESET_PARAMS,
  PerformanceMetrics,
  RecordingState,
  ForceRecording,
  CSVExportOptions,
  ViewMode,
} from '../types';
import { ForceRecorder } from '../forces/ForceRecorder';

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer;
  private forceRecorder: ForceRecorder;
  private params: PresetParams;
  private initialized: boolean = false;

  constructor(canvas: HTMLCanvasElement, onMetricsUpdate?: (metrics: PerformanceMetrics) => void) {
    this.canvas = canvas;
    this.params = { ...DEFAULT_PRESET_PARAMS };
    this.renderer = new WebGPURenderer(canvas, this.params, onMetricsUpdate);
    this.forceRecorder = new ForceRecorder();

    this.forceRecorder.setStateCallback((point) => {
      if (point) {
        this.renderer.setMousePosition(point.x, point.y);
        this.renderer.setMouseActive(true);
      } else {
        this.renderer.setMouseActive(false);
      }
    });
  }

  public async init(): Promise<boolean> {
    this.resize();
    const success = await this.renderer.init();
    if (success) {
      this.initialized = true;
    }
    return success;
  }

  public start(): void {
    if (this.initialized) {
      this.renderer.start();
    }
  }

  public stop(): void {
    this.renderer.stop();
    this.forceRecorder.stopPlayback();
    this.forceRecorder.stopRecording();
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (this.initialized) {
      this.renderer.resize(width, height);
    } else {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  public setMousePosition(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    this.renderer.setMousePosition(x, y);

    if (this.forceRecorder.getState() === 'recording') {
      this.forceRecorder.recordMousePosition(x, y, 1.0);
    }
  }

  public setMouseActive(active: boolean): void {
    this.renderer.setMouseActive(active);
  }

  public updateParams(params: Partial<PresetParams>): void {
    const oldCount = this.params.particleCount;
    Object.assign(this.params, params);

    if (params.particleCount !== undefined && params.particleCount !== oldCount) {
      this.renderer.updateParticleCount(params.particleCount);
    }

    if (params.gravityStrength !== undefined) {
      this.renderer.updateForceFieldParams({ gravityStrength: params.gravityStrength });
    }
    if (params.gravityRadius !== undefined) {
      this.renderer.updateForceFieldParams({ gravityRadius: params.gravityRadius });
    }
    if (params.repulsionStrength !== undefined) {
      this.renderer.updateForceFieldParams({ repulsionStrength: params.repulsionStrength });
    }
    if (params.repulsionRadius !== undefined) {
      this.renderer.updateForceFieldParams({ repulsionRadius: params.repulsionRadius });
    }
    if (params.vortexStrength !== undefined) {
      this.renderer.updateForceFieldParams({ vortexStrength: params.vortexStrength });
    }
    if (params.vortexRadius !== undefined) {
      this.renderer.updateForceFieldParams({ vortexRadius: params.vortexRadius });
    }
    if (params.mouseStrength !== undefined) {
      this.renderer.updateForceFieldParams({ mouseStrength: params.mouseStrength });
    }
    if (params.mouseRadius !== undefined) {
      this.renderer.updateForceFieldParams({ mouseRadius: params.mouseRadius });
    }
    if (params.damping !== undefined) {
      this.renderer.updateForceFieldParams({ damping: params.damping });
    }
    if (params.bounceDamping !== undefined) {
      this.renderer.updateForceFieldParams({ bounceDamping: params.bounceDamping });
    }

    if (params.boidsEnabled !== undefined) {
      this.renderer.setBoidsEnabled(params.boidsEnabled);
    }
    if (params.separationStrength !== undefined) {
      this.renderer.updateBoidsParams({ separationStrength: params.separationStrength });
    }
    if (params.separationRadius !== undefined) {
      this.renderer.updateBoidsParams({ separationRadius: params.separationRadius });
    }
    if (params.alignmentStrength !== undefined) {
      this.renderer.updateBoidsParams({ alignmentStrength: params.alignmentStrength });
    }
    if (params.alignmentRadius !== undefined) {
      this.renderer.updateBoidsParams({ alignmentRadius: params.alignmentRadius });
    }
    if (params.cohesionStrength !== undefined) {
      this.renderer.updateBoidsParams({ cohesionStrength: params.cohesionStrength });
    }
    if (params.cohesionRadius !== undefined) {
      this.renderer.updateBoidsParams({ cohesionRadius: params.cohesionRadius });
    }

    if (params.particleSize !== undefined) {
      this.renderer.updateRenderParams({ particleSize: params.particleSize });
    }
    if (params.colorMode !== undefined) {
      this.renderer.setColorMode(params.colorMode);
    }
    if (params.baseColor !== undefined) {
      this.renderer.updateRenderParams({
        baseColorR: params.baseColor[0],
        baseColorG: params.baseColor[1],
        baseColorB: params.baseColor[2],
      });
    }
    if (params.lodBias !== undefined) {
      this.renderer.updateRenderParams({ lodBias: params.lodBias });
    }
    if (params.viewMode !== undefined) {
      this.renderer.setViewMode(params.viewMode);
    }
    if (params.viewAngle !== undefined) {
      this.renderer.updateRenderParams({ viewAngle: params.viewAngle });
    }
    if (params.viewZoom !== undefined) {
      this.renderer.updateRenderParams({ viewZoom: params.viewZoom });
    }
  }

  public getParams(): PresetParams {
    return { ...this.params };
  }

  public resetParticles(): void {
    this.renderer.resetParticles();
  }

  public destroy(): void {
    this.renderer.destroy();
    this.forceRecorder.destroy();
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public startRecording(): void {
    this.forceRecorder.startRecording(this.params, this.params.particleCount);
  }

  public stopRecording(): ForceRecording | null {
    return this.forceRecorder.stopRecording();
  }

  public startPlayback(recording: ForceRecording, loop: boolean = true): void {
    this.forceRecorder.startPlayback(recording, loop);
  }

  public pausePlayback(): void {
    this.forceRecorder.pausePlayback();
  }

  public resumePlayback(): void {
    this.forceRecorder.resumePlayback();
  }

  public stopPlayback(): void {
    this.forceRecorder.stopPlayback();
  }

  public getRecordingState(): RecordingState {
    return this.forceRecorder.getState();
  }

  public getRecordings(): ForceRecording[] {
    return this.forceRecorder.getRecordings();
  }

  public getRecordingDuration(): number {
    return this.forceRecorder.getRecordingDuration();
  }

  public getPlaybackProgress(): number {
    return this.forceRecorder.getPlaybackProgress();
  }

  public deleteRecording(id: string): boolean {
    return this.forceRecorder.deleteRecording(id);
  }

  public renameRecording(id: string, name: string): boolean {
    return this.forceRecorder.renameRecording(id, name);
  }

  public setPlaybackSpeed(speed: number): void {
    this.forceRecorder.setPlaybackSpeed(speed);
  }

  public async exportToCSV(options: Partial<CSVExportOptions> = {}): Promise<string> {
    return this.renderer.exportToCSV(options);
  }

  public async downloadCSV(filename?: string): Promise<void> {
    await this.renderer.downloadCSV(filename);
  }

  public async exportStatistics(): Promise<string> {
    return this.renderer.exportStatistics();
  }

  public setViewMode(mode: ViewMode): void {
    this.params.viewMode = mode;
    this.renderer.setViewMode(mode);
  }
}
