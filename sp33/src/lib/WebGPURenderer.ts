import type { OBJData, RenderParams, RenderStats, TextureData } from '../../shared/types.js';
import { getMaterialGPUData, generateCheckerboardTexture, getTextureGPUData } from './objLoader.js';
import { buildSAHBVH, getBVHGPUData } from './bvh.js';
import { downloadEXR } from './exr.js';
import raytraceShader from '../shaders/raytrace.wgsl';
import displayShader from '../shaders/display.wgsl';

const WORKGROUP_SIZE = 8;

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  onStatsUpdate?: (stats: RenderStats) => void;
}

export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private contextFormat: GPUTextureFormat = 'bgra8unorm';
  private onStatsUpdate?: (stats: RenderStats) => void;

  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private computeBindGroup: GPUBindGroup | null = null;
  private renderBindGroup: GPUBindGroup | null = null;

  private cameraBuffer: GPUBuffer | null = null;
  private materialsBuffer: GPUBuffer | null = null;
  private trianglesBuffer: GPUBuffer | null = null;
  private accumulatorBuffer: GPUBuffer | null = null;
  private readbackBuffer: GPUBuffer | null = null;
  private computeParamsBuffer: GPUBuffer | null = null;
  private renderParamsBuffer: GPUBuffer | null = null;
  private bvhNodesBuffer: GPUBuffer | null = null;
  private triIndicesBuffer: GPUBuffer | null = null;
  private textureBuffer: GPUBuffer | null = null;

  private raytraceShaderCode: string = '';
  private displayShaderCode: string = '';

  private currentFrame = 0;
  private maxBounces = 8;
  private triangleCount = 0;
  private nodeCount = 0;
  private textureWidth = 0;
  private textureHeight = 0;
  private isRendering = false;
  private animationFrameId: number | null = null;

  private lastFrameTime = performance.now();
  private frameCount = 0;
  private fps = 0;
  private renderStartTime = 0;

  private currentCameraData: Float32Array | null = null;

  private pendingSetSceneId: number = 0;
  private cameraDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly CAMERA_DEBOUNCE_MS = 16;

  private readbackPending = false;
  private readbackWidth = 0;
  private readbackHeight = 0;

  private enableAO = false;
  private aoSamples = 4;
  private aoRadius = 0.5;
  private enableSoftShadows = false;
  private shadowSamples = 4;
  private lightRadius = 0.5;

  constructor(options: RendererOptions) {
    this.canvas = options.canvas;
    this.onStatsUpdate = options.onStatsUpdate;
  }

  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to get GPU adapter');
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');
    if (!this.context) {
      throw new Error('Failed to get WebGPU context');
    }

    this.contextFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.contextFormat,
      alphaMode: 'premultiplied',
    });

    this.loadShaders();
    this.createPipelines(this.contextFormat);
  }

  private loadShaders(): void {
    this.raytraceShaderCode = raytraceShader;
    this.displayShaderCode = displayShader;
  }

  private async createPipelines(format: GPUTextureFormat): Promise<void> {
    if (!this.device) return;

    const raytraceModule = this.device.createShaderModule({
      code: this.raytraceShaderCode,
    });

    const displayModule = this.device.createShaderModule({
      code: this.displayShaderCode,
    });

    const computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      ],
    });

    const computePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [computeBindGroupLayout],
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: computePipelineLayout,
      compute: { module: raytraceModule, entryPoint: 'main' },
    });

    const renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    const renderPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: renderPipelineLayout,
      vertex: { module: displayModule, entryPoint: 'vs_main' },
      fragment: {
        module: displayModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  async setScene(objData: OBJData): Promise<void> {
    if (!this.device) return;

    const sceneId = ++this.pendingSetSceneId;

    this.stop();
    this.isRendering = false;

    this.triangleCount = objData.triangleCount;

    const triangleData = this.buildTriangleData(objData);
    const materialData = getMaterialGPUData(objData.materials);

    const bvh = buildSAHBVH(objData.vertices, objData.indices, objData.triangleCount);
    const bvhNodeData = getBVHGPUData(bvh);
    this.nodeCount = bvh.nodeCount;

    const texture = generateCheckerboardTexture(512, 512, 16);
    const textureGPUData = getTextureGPUData(texture);
    this.textureWidth = texture.width;
    this.textureHeight = texture.height;

    if (sceneId !== this.pendingSetSceneId) return;

    this.materialsBuffer = this.createBuffer(
      materialData.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    this.device.queue.writeBuffer(this.materialsBuffer, 0, materialData);

    this.trianglesBuffer = this.createBuffer(
      triangleData.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    this.device.queue.writeBuffer(this.trianglesBuffer, 0, triangleData);

    this.bvhNodesBuffer = this.createBuffer(
      Math.max(bvhNodeData.byteLength, 32),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    if (bvhNodeData.byteLength > 0) {
      this.device.queue.writeBuffer(this.bvhNodesBuffer, 0, bvhNodeData);
    }

    this.triIndicesBuffer = this.createBuffer(
      Math.max(bvh.triangleIndices.byteLength, 4),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    if (bvh.triangleIndices.byteLength > 0) {
      this.device.queue.writeBuffer(this.triIndicesBuffer, 0, bvh.triangleIndices);
    }

    this.textureBuffer = this.createBuffer(
      Math.max(textureGPUData.byteLength, 64),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    if (textureGPUData.byteLength > 0) {
      this.device.queue.writeBuffer(this.textureBuffer, 0, textureGPUData);
    }

    this.cameraBuffer = this.createBuffer(
      16 * 4,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );

    this.resize(this.canvas.width, this.canvas.height);
    this.resetAccumulation();
    this.updateBindGroups();
  }

  private buildTriangleData(objData: OBJData): Float32Array {
    const stride = 24;
    const data = new Float32Array(objData.triangleCount * stride);

    for (let i = 0; i < objData.triangleCount; i++) {
      const i0 = objData.indices[i * 3];
      const i1 = objData.indices[i * 3 + 1];
      const i2 = objData.indices[i * 3 + 2];
      const matId = objData.materialIds[i * 3];

      const offset = i * stride;

      data[offset] = objData.vertices[i0 * 3];
      data[offset + 1] = objData.vertices[i0 * 3 + 1];
      data[offset + 2] = objData.vertices[i0 * 3 + 2];
      data[offset + 3] = matId;

      data[offset + 4] = objData.vertices[i1 * 3];
      data[offset + 5] = objData.vertices[i1 * 3 + 1];
      data[offset + 6] = objData.vertices[i1 * 3 + 2];
      data[offset + 7] = 0;

      data[offset + 8] = objData.vertices[i2 * 3];
      data[offset + 9] = objData.vertices[i2 * 3 + 1];
      data[offset + 10] = objData.vertices[i2 * 3 + 2];
      data[offset + 11] = 0;

      const uv0x = objData.uvs.length > 0 ? objData.uvs[i0 * 2] : 0;
      const uv0y = objData.uvs.length > 0 ? objData.uvs[i0 * 2 + 1] : 0;
      const uv1x = objData.uvs.length > 0 ? objData.uvs[i1 * 2] : 0;
      const uv1y = objData.uvs.length > 0 ? objData.uvs[i1 * 2 + 1] : 0;
      const uv2x = objData.uvs.length > 0 ? objData.uvs[i2 * 2] : 0;
      const uv2y = objData.uvs.length > 0 ? objData.uvs[i2 * 2 + 1] : 0;

      data[offset + 12] = uv0x;
      data[offset + 13] = uv0y;
      data[offset + 14] = 0;
      data[offset + 15] = 0;

      data[offset + 16] = uv1x;
      data[offset + 17] = uv1y;
      data[offset + 18] = 0;
      data[offset + 19] = 0;

      data[offset + 20] = uv2x;
      data[offset + 21] = uv2y;
      data[offset + 22] = 0;
      data[offset + 23] = 0;
    }

    return data;
  }

  resize(width: number, height: number): void {
    if (!this.device || !this.context) return;

    this.canvas.width = width;
    this.canvas.height = height;

    this.context.configure({
      device: this.device,
      format: this.contextFormat,
      alphaMode: 'premultiplied',
    });

    const pixelCount = width * height;
    const accumulatorSize = pixelCount * 16;

    if (this.accumulatorBuffer) {
      this.accumulatorBuffer.destroy();
    }
    if (this.readbackBuffer) {
      this.readbackBuffer.destroy();
    }

    this.accumulatorBuffer = this.createBuffer(
      accumulatorSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    );

    this.readbackBuffer = this.device.createBuffer({
      size: accumulatorSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      mappedAtCreation: false,
    });

    if (this.computeParamsBuffer) {
      this.computeParamsBuffer.destroy();
    }
    if (this.renderParamsBuffer) {
      this.renderParamsBuffer.destroy();
    }

    this.computeParamsBuffer = this.createBuffer(
      64,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.renderParamsBuffer = this.createBuffer(
      16,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.resetAccumulation();
    this.updateBindGroups();
  }

  updateCamera(cameraData: Float32Array): void {
    if (!this.device || !this.cameraBuffer) return;

    this.currentCameraData = cameraData;

    if (this.cameraDebounceTimer !== null) {
      clearTimeout(this.cameraDebounceTimer);
    }

    this.cameraDebounceTimer = setTimeout(() => {
      if (!this.device || !this.cameraBuffer || !this.currentCameraData) return;
      this.device.queue.writeBuffer(this.cameraBuffer, 0, this.currentCameraData);
      this.resetAccumulation();
      this.cameraDebounceTimer = null;
    }, WebGPURenderer.CAMERA_DEBOUNCE_MS);
  }

  updateParams(params: Partial<RenderParams>): void {
    if (params.maxBounces !== undefined) {
      this.maxBounces = params.maxBounces;
      this.resetAccumulation();
    }
    if (params.enableAO !== undefined) {
      this.enableAO = params.enableAO;
      this.resetAccumulation();
    }
    if (params.aoSamples !== undefined) {
      this.aoSamples = params.aoSamples;
      this.resetAccumulation();
    }
    if (params.aoRadius !== undefined) {
      this.aoRadius = params.aoRadius;
      this.resetAccumulation();
    }
    if (params.enableSoftShadows !== undefined) {
      this.enableSoftShadows = params.enableSoftShadows;
      this.resetAccumulation();
    }
    if (params.shadowSamples !== undefined) {
      this.shadowSamples = params.shadowSamples;
      this.resetAccumulation();
    }
    if (params.lightRadius !== undefined) {
      this.lightRadius = params.lightRadius;
      this.resetAccumulation();
    }
  }

  resetAccumulation(): void {
    this.currentFrame = 0;
    this.renderStartTime = performance.now();

    if (this.accumulatorBuffer && this.device) {
      const size = this.canvas.width * this.canvas.height * 16;
      this.device.queue.writeBuffer(
        this.accumulatorBuffer,
        0,
        new Float32Array(size / 4)
      );
    }
  }

  private updateBindGroups(): void {
    if (!this.device || !this.computePipeline || !this.renderPipeline) return;
    if (!this.cameraBuffer || !this.materialsBuffer || !this.trianglesBuffer) return;
    if (!this.accumulatorBuffer || !this.computeParamsBuffer || !this.renderParamsBuffer) return;
    if (!this.bvhNodesBuffer || !this.triIndicesBuffer || !this.textureBuffer) return;

    const computeBindGroupLayout = this.computePipeline.getBindGroupLayout(0);
    this.computeBindGroup = this.device.createBindGroup({
      layout: computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: this.materialsBuffer } },
        { binding: 2, resource: { buffer: this.trianglesBuffer } },
        { binding: 3, resource: { buffer: this.accumulatorBuffer } },
        { binding: 4, resource: { buffer: this.computeParamsBuffer } },
        { binding: 5, resource: { buffer: this.bvhNodesBuffer } },
        { binding: 6, resource: { buffer: this.triIndicesBuffer } },
        { binding: 7, resource: { buffer: this.textureBuffer } },
      ],
    });

    const renderBindGroupLayout = this.renderPipeline.getBindGroupLayout(0);
    this.renderBindGroup = this.device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.accumulatorBuffer } },
        { binding: 1, resource: { buffer: this.renderParamsBuffer } },
      ],
    });
  }

  private createBuffer(size: number, usage: number): GPUBuffer {
    if (!this.device) throw new Error('Device not initialized');

    const alignedSize = Math.max(size, 16);

    return this.device.createBuffer({
      size: alignedSize,
      usage,
      mappedAtCreation: false,
    });
  }

  start(): void {
    if (this.isRendering) return;
    this.isRendering = true;
    this.renderStartTime = performance.now();
    this.frameCount = 0;
    this.renderLoop();
  }

  stop(): void {
    this.isRendering = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private renderLoop(): void {
    if (!this.isRendering) return;

    this.render();
    this.updateFPS();
    this.emitStats();

    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  private render(): void {
    if (!this.device || !this.context) return;
    if (!this.computePipeline || !this.renderPipeline) return;
    if (!this.computeBindGroup || !this.renderBindGroup) return;
    if (!this.computeParamsBuffer || !this.renderParamsBuffer) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    const paramsBuffer = new ArrayBuffer(64);
    const paramsView = new DataView(paramsBuffer);
    paramsView.setUint32(0, this.currentFrame, true);
    paramsView.setUint32(4, this.maxBounces, true);
    paramsView.setUint32(8, width, true);
    paramsView.setUint32(12, height, true);
    paramsView.setUint32(16, Math.floor(Math.random() * 0xffffffff), true);
    paramsView.setFloat32(20, 0.0002, true);
    paramsView.setUint32(24, this.triangleCount, true);
    paramsView.setUint32(28, this.nodeCount, true);
    paramsView.setUint32(32, this.enableAO ? 1 : 0, true);
    paramsView.setUint32(36, this.aoSamples, true);
    paramsView.setFloat32(40, this.aoRadius, true);
    paramsView.setUint32(44, this.enableSoftShadows ? 1 : 0, true);
    paramsView.setUint32(48, this.shadowSamples, true);
    paramsView.setFloat32(52, this.lightRadius, true);
    paramsView.setUint32(56, this.textureWidth, true);
    paramsView.setUint32(60, this.textureHeight, true);

    this.device.queue.writeBuffer(this.computeParamsBuffer, 0, paramsBuffer);

    const renderParams = new Uint32Array(4);
    renderParams[0] = width;
    renderParams[1] = height;
    renderParams[2] = this.currentFrame;
    this.device.queue.writeBuffer(this.renderParamsBuffer, 0, renderParams);

    const commandEncoder = this.device.createCommandEncoder();

    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);

    const workgroupCountX = Math.ceil(width / WORKGROUP_SIZE);
    const workgroupCountY = Math.ceil(height / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    computePass.end();

    if (this.readbackPending && this.readbackBuffer && this.accumulatorBuffer) {
      const pixelCount = this.readbackWidth * this.readbackHeight;
      const copySize = pixelCount * 16;
      commandEncoder.copyBufferToBuffer(
        this.accumulatorBuffer,
        0,
        this.readbackBuffer,
        0,
        copySize
      );
      this.readbackPending = false;
    }

    const textureView = this.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.draw(6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    this.currentFrame++;
  }

  async readHDRData(): Promise<Float32Array> {
    if (!this.device || !this.accumulatorBuffer || !this.readbackBuffer) {
      throw new Error('Renderer not initialized');
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const pixelCount = width * height;

    this.readbackWidth = width;
    this.readbackHeight = height;
    this.readbackPending = true;

    await new Promise<void>((resolve) => {
      const checkReadback = () => {
        if (!this.readbackPending) {
          resolve();
        } else {
          requestAnimationFrame(checkReadback);
        }
      };
      checkReadback();
    });

    await this.device.queue.onSubmittedWorkDone();

    await this.readbackBuffer.mapAsync(GPUMapMode.READ);
    const mappedData = new Float32Array(this.readbackBuffer.getMappedRange());
    const result = new Float32Array(mappedData);
    this.readbackBuffer.unmap();

    return result;
  }

  async saveHDRImage(filename: string = 'render.exr'): Promise<void> {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const hdrData = await this.readHDRData();
    downloadEXR(width, height, hdrData, filename);
  }

  private updateFPS(): void {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }

  private emitStats(): void {
    if (!this.onStatsUpdate) return;

    this.onStatsUpdate({
      currentSample: this.currentFrame,
      fps: this.fps,
      triangleCount: this.triangleCount,
      rayCount: this.canvas.width * this.canvas.height * this.currentFrame,
      renderTime: (performance.now() - this.renderStartTime) / 1000,
    });
  }

  async saveImage(filename: string = 'render.png'): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(this.canvas, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  getCurrentFrame(): number {
    return this.currentFrame;
  }

  getTriangleCount(): number {
    return this.triangleCount;
  }

  destroy(): void {
    this.stop();

    if (this.cameraDebounceTimer !== null) {
      clearTimeout(this.cameraDebounceTimer);
      this.cameraDebounceTimer = null;
    }

    if (this.cameraBuffer) this.cameraBuffer.destroy();
    if (this.materialsBuffer) this.materialsBuffer.destroy();
    if (this.trianglesBuffer) this.trianglesBuffer.destroy();
    if (this.accumulatorBuffer) this.accumulatorBuffer.destroy();
    if (this.readbackBuffer) this.readbackBuffer.destroy();
    if (this.computeParamsBuffer) this.computeParamsBuffer.destroy();
    if (this.renderParamsBuffer) this.renderParamsBuffer.destroy();
    if (this.bvhNodesBuffer) this.bvhNodesBuffer.destroy();
    if (this.triIndicesBuffer) this.triIndicesBuffer.destroy();
    if (this.textureBuffer) this.textureBuffer.destroy();

    if (this.context) {
      this.context.unconfigure();
    }
  }
}
