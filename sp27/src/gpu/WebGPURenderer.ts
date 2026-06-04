import computeShaderSource from './shaders/compute.wgsl?raw';
import renderShaderSource from './shaders/render.wgsl?raw';
import { BufferManager } from './BufferManager';
import {
  ForceFieldParams,
  RenderParams,
  BoidsParams,
  FORCE_FIELD_SIZE,
  RENDER_PARAMS_SIZE,
  BOIDS_SIZE,
  COLOR_MODE_VALUES,
  ColorMode,
  PresetParams,
  PerformanceMetrics,
  ViewMode,
  VIEW_MODE_VALUES,
  CSVExportOptions,
} from '../types';
import { ParticleInitializer } from '../particles/ParticleInitializer';
import { CSVExporter } from '../utils/CSVExporter';

export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private presentationFormat!: GPUTextureFormat;
  private bufferManager!: BufferManager;
  private computePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;

  private computeBindGroup01!: GPUBindGroup;
  private computeBindGroup10!: GPUBindGroup;
  private renderBindGroup0!: GPUBindGroup;
  private renderBindGroup1!: GPUBindGroup;

  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private currentFps: number = 0;
  private currentFrameTime: number = 0;
  private running: boolean = false;

  private forceFieldParams: ForceFieldParams;
  private boidsParams: BoidsParams;
  private renderParams: RenderParams;
  private particleCount: number;
  private width: number;
  private height: number;
  private onMetricsUpdate?: (metrics: PerformanceMetrics) => void;

  private bufferSwapCount: number = 0;
  private currentPresetParams: PresetParams;

  constructor(canvas: HTMLCanvasElement, params: PresetParams, onMetricsUpdate?: (metrics: PerformanceMetrics) => void) {
    this.canvas = canvas;
    this.particleCount = params.particleCount;
    this.width = canvas.width;
    this.height = canvas.height;
    this.onMetricsUpdate = onMetricsUpdate;
    this.currentPresetParams = params;

    this.forceFieldParams = {
      gravityStrength: params.gravityStrength,
      gravityRadius: params.gravityRadius,
      repulsionStrength: params.repulsionStrength,
      repulsionRadius: params.repulsionRadius,
      vortexStrength: params.vortexStrength,
      vortexRadius: params.vortexRadius,
      mouseStrength: params.mouseStrength,
      mouseRadius: params.mouseRadius,
      damping: params.damping,
      bounceDamping: params.bounceDamping,
      centerX: this.width / 2,
      centerY: this.height / 2,
      mouseX: this.width / 2,
      mouseY: this.height / 2,
      mouseActive: 0,
      deltaTime: 1 / 60,
    };

    this.boidsParams = {
      separationStrength: params.separationStrength,
      separationRadius: params.separationRadius,
      alignmentStrength: params.alignmentStrength,
      alignmentRadius: params.alignmentRadius,
      cohesionStrength: params.cohesionStrength,
      cohesionRadius: params.cohesionRadius,
      boidsEnabled: params.boidsEnabled ? 1 : 0,
      cellSize: 50,
    };

    this.renderParams = {
      particleSize: params.particleSize,
      width: this.width,
      height: this.height,
      colorMode: COLOR_MODE_VALUES[params.colorMode],
      baseColorR: params.baseColor[0],
      baseColorG: params.baseColor[1],
      baseColorB: params.baseColor[2],
      time: 0,
      lodBias: params.lodBias || 0,
      renderMask: 0,
      viewMode: VIEW_MODE_VALUES[params.viewMode],
      viewAngle: params.viewAngle,
      viewZoom: params.viewZoom,
    };
  }

  public async init(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error('WebGPU is not supported in this browser');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error('Failed to get GPU adapter');
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu')!;
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: 'premultiplied',
    });

    this.bufferManager = new BufferManager(this.device, this.particleCount);

    this.createComputePipeline();
    this.createRenderPipeline();
    this.createAllBindGroups();
    this.uploadInitialParticles();

    return true;
  }

  private createComputePipeline(): void {
    const computeModule = this.device.createShaderModule({
      code: computeShaderSource,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.createComputeBindGroupLayout()],
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: computeModule,
        entryPoint: 'main',
      },
    });
  }

  private createComputeBindGroupLayout(): GPUBindGroupLayout {
    const entries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      },
    ];
    return this.device.createBindGroupLayout({ entries });
  }

  private createRenderPipeline(): void {
    const renderModule = this.device.createShaderModule({
      code: renderShaderSource,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.createRenderBindGroupLayout()],
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: renderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: renderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.presentationFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'src-alpha',
                dstFactor: 'one',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    });
  }

  private createRenderBindGroupLayout(): GPUBindGroupLayout {
    const entries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ];
    return this.device.createBindGroupLayout({ entries });
  }

  private createAllBindGroups(): void {
    const buf0 = this.bufferManager.getParticleBuffer0();
    const buf1 = this.bufferManager.getParticleBuffer1();
    const forceBuf = this.bufferManager.getForceFieldUniformBuffer();
    const boidsBuf = this.bufferManager.getBoidsUniformBuffer();
    const renderBuf = this.bufferManager.getRenderParamsUniformBuffer();

    this.computeBindGroup01 = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buf0 } },
        { binding: 1, resource: { buffer: buf1 } },
        { binding: 2, resource: { buffer: forceBuf } },
        { binding: 3, resource: { buffer: boidsBuf } },
      ],
    });

    this.computeBindGroup10 = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buf1 } },
        { binding: 1, resource: { buffer: buf0 } },
        { binding: 2, resource: { buffer: forceBuf } },
        { binding: 3, resource: { buffer: boidsBuf } },
      ],
    });

    this.renderBindGroup0 = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buf0 } },
        { binding: 1, resource: { buffer: renderBuf } },
      ],
    });

    this.renderBindGroup1 = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buf1 } },
        { binding: 1, resource: { buffer: renderBuf } },
      ],
    });
  }

  private uploadInitialParticles(): void {
    const particles = ParticleInitializer.generateRandomParticles(
      this.particleCount,
      this.width,
      this.height
    );
    this.bufferManager.uploadInitialParticles(particles);
  }

  public updateParticleCount(count: number): void {
    this.stop();
    this.particleCount = count;
    this.bufferManager.resize(count);
    this.uploadInitialParticles();
    this.createAllBindGroups();
    this.bufferSwapCount = 0;
    this.start();
  }

  public setMousePosition(x: number, y: number): void {
    this.forceFieldParams.mouseX = x;
    this.forceFieldParams.mouseY = y;
  }

  public setMouseActive(active: boolean): void {
    this.forceFieldParams.mouseActive = active ? 1 : 0;
  }

  public updateForceFieldParams(params: Partial<ForceFieldParams>): void {
    Object.assign(this.forceFieldParams, params);
  }

  public updateBoidsParams(params: Partial<BoidsParams>): void {
    Object.assign(this.boidsParams, params);
  }

  public setBoidsEnabled(enabled: boolean): void {
    this.boidsParams.boidsEnabled = enabled ? 1 : 0;
  }

  public updateRenderParams(params: Partial<RenderParams>): void {
    Object.assign(this.renderParams, params);
  }

  public setColorMode(mode: ColorMode): void {
    this.renderParams.colorMode = COLOR_MODE_VALUES[mode];
  }

  public setViewMode(mode: ViewMode): void {
    this.renderParams.viewMode = VIEW_MODE_VALUES[mode];
  }

  public resetParticles(): void {
    this.uploadInitialParticles();
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.forceFieldParams.centerX = width / 2;
    this.forceFieldParams.centerY = height / 2;
    this.renderParams.width = width;
    this.renderParams.height = height;
    this.uploadInitialParticles();
  }

  public async exportToCSV(options: Partial<CSVExportOptions> = {}): Promise<string> {
    const readBuffer = this.bufferManager.getCurrentReadBuffer(this.bufferSwapCount);
    return CSVExporter.exportParticles(this.device, readBuffer, this.particleCount, options);
  }

  public async downloadCSV(filename?: string): Promise<void> {
    const csv = await this.exportToCSV();
    const actualFilename = filename || `particles_${Date.now()}.csv`;
    CSVExporter.downloadCSV(csv, actualFilename);
  }

  public async exportStatistics(): Promise<string> {
    const readBuffer = this.bufferManager.getCurrentReadBuffer(this.bufferSwapCount);
    return CSVExporter.exportStatistics(this.device, readBuffer, this.particleCount);
  }

  public getCurrentPresetParams(): PresetParams {
    return { ...this.currentPresetParams };
  }

  public getDevice(): GPUDevice {
    return this.device;
  }

  public getCurrentReadBuffer(): GPUBuffer {
    return this.bufferManager.getCurrentReadBuffer(this.bufferSwapCount);
  }

  private writeUniforms(): void {
    const forceData = new Float32Array(FORCE_FIELD_SIZE / 4);
    forceData[0] = this.forceFieldParams.gravityStrength;
    forceData[1] = this.forceFieldParams.gravityRadius;
    forceData[2] = this.forceFieldParams.repulsionStrength;
    forceData[3] = this.forceFieldParams.repulsionRadius;
    forceData[4] = this.forceFieldParams.vortexStrength;
    forceData[5] = this.forceFieldParams.vortexRadius;
    forceData[6] = this.forceFieldParams.mouseStrength;
    forceData[7] = this.forceFieldParams.mouseRadius;
    forceData[8] = this.forceFieldParams.damping;
    forceData[9] = this.forceFieldParams.bounceDamping;
    forceData[10] = this.forceFieldParams.centerX;
    forceData[11] = this.forceFieldParams.centerY;
    forceData[12] = this.forceFieldParams.mouseX;
    forceData[13] = this.forceFieldParams.mouseY;
    forceData[14] = this.forceFieldParams.mouseActive;
    forceData[15] = this.forceFieldParams.deltaTime;
    this.bufferManager.writeForceFieldParams(forceData);

    const boidsData = new Float32Array(BOIDS_SIZE / 4);
    boidsData[0] = this.boidsParams.separationStrength;
    boidsData[1] = this.boidsParams.separationRadius;
    boidsData[2] = this.boidsParams.alignmentStrength;
    boidsData[3] = this.boidsParams.alignmentRadius;
    boidsData[4] = this.boidsParams.cohesionStrength;
    boidsData[5] = this.boidsParams.cohesionRadius;
    boidsData[6] = this.boidsParams.boidsEnabled;
    boidsData[7] = this.boidsParams.cellSize;
    this.bufferManager.writeBoidsParams(boidsData);

    const renderData = new Float32Array(RENDER_PARAMS_SIZE / 4);
    renderData[0] = this.renderParams.particleSize;
    renderData[1] = this.renderParams.width;
    renderData[2] = this.renderParams.height;
    renderData[3] = this.renderParams.colorMode;
    renderData[4] = this.renderParams.baseColorR;
    renderData[5] = this.renderParams.baseColorG;
    renderData[6] = this.renderParams.baseColorB;
    renderData[7] = this.renderParams.time;
    renderData[8] = this.renderParams.lodBias;
    renderData[9] = this.renderParams.renderMask;
    renderData[10] = this.renderParams.viewMode;
    renderData[11] = this.renderParams.viewAngle;
    renderData[12] = this.renderParams.viewZoom;
    this.bufferManager.writeRenderParams(renderData);
  }

  private getComputeBindGroup(): GPUBindGroup {
    return this.bufferSwapCount % 2 === 0 ? this.computeBindGroup01 : this.computeBindGroup10;
  }

  private getRenderBindGroup(): GPUBindGroup {
    return this.bufferSwapCount % 2 === 0 ? this.renderBindGroup1 : this.renderBindGroup0;
  }

  private frame = (time: number): void => {
    if (!this.running) return;

    const deltaTime = this.lastTime ? (time - this.lastTime) / 1000 : 1 / 60;
    this.lastTime = time;
    this.forceFieldParams.deltaTime = Math.min(deltaTime, 1 / 30);
    this.renderParams.time = time / 1000;

    this.frameCount++;
    this.fpsUpdateTime += deltaTime;
    if (this.fpsUpdateTime >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsUpdateTime);
      this.currentFrameTime = Math.round((this.fpsUpdateTime / this.frameCount) * 1000 * 100) / 100;
      this.frameCount = 0;
      this.fpsUpdateTime = 0;

      if (this.onMetricsUpdate) {
        this.onMetricsUpdate({
          fps: this.currentFps,
          particleCount: this.particleCount,
          renderedCount: Math.round(this.particleCount * (this.renderParams.lodBias > 0.5 ? 1.0 : 0.55)),
          frameTime: this.currentFrameTime,
          computeTime: 0,
          renderTime: 0,
        });
      }
    }

    this.writeUniforms();

    const commandEncoder = this.device.createCommandEncoder();

    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.getComputeBindGroup());
    computePass.dispatchWorkgroups(Math.ceil(this.particleCount / 128));
    computePass.end();

    this.bufferSwapCount++;

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.02, b: 0.04, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.getRenderBindGroup());
    renderPass.draw(6, this.particleCount, 0, 0);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    this.animationFrameId = requestAnimationFrame(this.frame);
  };

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.animationFrameId = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy(): void {
    this.stop();
    if (this.bufferManager) {
      this.bufferManager.destroy();
    }
  }
}
