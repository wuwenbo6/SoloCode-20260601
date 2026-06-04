import {
  GRID_SIZE,
  PARTICLE_COUNT,
  CELL_COUNT,
  PARTICLE_SIZE,
  SIM_PARAMS_SIZE,
  WIND_PARAMS_SIZE,
  MOUSE_INTERACTION_SIZE,
  CAMERA_SIZE,
  RENDER_PARAMS_SIZE,
  SPHERE_SIZE,
  MAX_SPHERES,
  SELF_COLLISION_SIZE,
  MOUSE_MODE,
  createParticles,
  createSprings,
  mat4Perspective,
  mat4LookAt,
  mat4Multiply,
  mat4Inverse,
  screenToWorld,
  getParticleIndex,
  type MouseMode,
  type SimParams,
  type WindParams,
  type MouseInteraction,
  type SphereCollider,
  type SelfCollisionParams,
} from './types';

import computeShaderSource from './shaders/cloth_compute.wgsl?raw';
import renderShaderSource from './shaders/cloth_render.wgsl?raw';

export class ClothSimulation {
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private particleBuffer!: GPUBuffer;
  private springBuffer!: GPUBuffer;
  private simParamsBuffer!: GPUBuffer;
  private windParamsBuffer!: GPUBuffer;
  private mouseBuffer!: GPUBuffer;
  private cameraBuffer!: GPUBuffer;
  private renderParamsBuffer!: GPUBuffer;
  private sphereBuffer!: GPUBuffer;
  private selfCollisionBuffer!: GPUBuffer;
  private readbackBuffer!: GPUBuffer;

  private computeBindGroup!: GPUBindGroup;
  private renderBindGroup!: GPUBindGroup;

  private computePipelineLayout!: GPUPipelineLayout;
  private renderPipelineLayout!: GPUPipelineLayout;

  private pipelinePredict!: GPUComputePipeline;
  private pipelineSolve!: GPUComputePipeline;
  private pipelineIntegrate!: GPUComputePipeline;
  private pipelineTear!: GPUComputePipeline;
  private pipelineSelfCollision!: GPUComputePipeline;

  private pipelineTri!: GPURenderPipeline;
  private pipelineWire!: GPURenderPipeline;

  private springCount: number = 0;
  private structSpringCount: number = 0;

  private simParams: SimParams = {
    structCompliance: 0.00001,
    shearCompliance: 0.0001,
    bendCompliance: 0.001,
    damping: 0.995,
    gravity: [0, -9.8, 0],
    deltaTime: 1 / 60,
    numParticles: PARTICLE_COUNT,
    numSprings: 0,
    globalBreakThreshold: 1.0,
    subSteps: 8,
  };

  private windParams: WindParams = {
    strength: 3.0,
    time: 0,
    frequency: 0.5,
    direction: [1, 0, 0.5],
  };

  private mouse: MouseInteraction = {
    mode: MOUSE_MODE.DRAG,
    active: 0,
    particleIndex: 0,
    radius: 0.3,
    worldPos: [0, 0, 0],
    force: [0, 0, 0],
  };

  private cameraPos: [number, number, number] = [0, 2, 12];
  private cameraTarget: [number, number, number] = [0, 0, 0];
  private viewProjMatrix!: Float32Array;
  private viewProjInvMatrix!: Float32Array;

  private pinnedCorners: boolean = true;
  private showStress: boolean = true;
  private showWireframe: boolean = false;
  private showSpheres: boolean = true;
  private maxTension: number = 0.5;

  private spheres: SphereCollider[] = [];
  private selfCollisionParams: SelfCollisionParams = {
    thickness: 0.05,
    stiffness: 0.3,
    enabled: 0,
  };

  private exporting: boolean = false;
  private exportFrame: boolean = false;
  private exportFrameCount: number = 0;
  private exportFrames: string[] = [];

  private animationId: number | null = null;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsUpdateTime: number = 0;

  private isDragging: boolean = false;
  private draggedParticle: number = -1;

  private particleInitialPositions: Float32Array;

  private onFpsUpdate?: (fps: number) => void;

  constructor(canvas: HTMLCanvasElement, onFpsUpdate?: (fps: number) => void) {
    this.canvas = canvas;
    this.onFpsUpdate = onFpsUpdate;
    this.particleInitialPositions = new Float32Array(PARTICLE_COUNT * 3);
    const spacing = 8 / (GRID_SIZE - 1);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = getParticleIndex(x, y);
        this.particleInitialPositions[idx * 3] = (x - GRID_SIZE / 2) * spacing;
        this.particleInitialPositions[idx * 3 + 1] = 5;
        this.particleInitialPositions[idx * 3 + 2] = (y - GRID_SIZE / 2) * spacing;
      }
    }

    this.spheres = [
      { position: [0, 0, 0], radius: 1.5 },
      { position: [2, -1, 1], radius: 0 },
      { position: [-2, -0.5, -1], radius: 0 },
    ];
    for (let i = this.spheres.length; i < MAX_SPHERES; i++) {
      this.spheres.push({ position: [0, 0, 0], radius: 0 });
    }
  }

  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported by your browser');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to get GPU adapter');
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu')!;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.createBuffers();
    this.createBindGroups();
    this.createPipelines();
    this.updateCamera();

    document.getElementById('springs')!.textContent = this.springCount.toLocaleString();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.updateCamera();
  }

  private createBuffers(): void {
    const particleData = createParticles();
    const { data: springData, count, structCount } = createSprings();
    this.springCount = count;
    this.structSpringCount = structCount;
    this.simParams.numSprings = count;

    this.particleBuffer = this.createBuffer(
      particleData.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      particleData
    );

    this.springBuffer = this.createBuffer(
      springData.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      springData
    );

    this.simParamsBuffer = this.createBuffer(
      SIM_PARAMS_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.windParamsBuffer = this.createBuffer(
      WIND_PARAMS_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.mouseBuffer = this.createBuffer(
      MOUSE_INTERACTION_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.cameraBuffer = this.createBuffer(
      CAMERA_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.renderParamsBuffer = this.createBuffer(
      RENDER_PARAMS_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.sphereBuffer = this.createBuffer(
      SPHERE_SIZE * MAX_SPHERES,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.selfCollisionBuffer = this.createBuffer(
      SELF_COLLISION_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    this.readbackBuffer = this.createBuffer(
      PARTICLE_COUNT * PARTICLE_SIZE,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    );

    this.pinCorners();
  }

  private createBuffer(size: number, usage: number, data?: ArrayBufferView): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: Math.max(size, 16),
      usage,
      mappedAtCreation: !!data,
    });

    if (data) {
      const mapped = new Uint8Array(buffer.getMappedRange());
      mapped.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      buffer.unmap();
    }

    return buffer;
  }

  private createBindGroups(): void {
    const computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.computeBindGroup = this.device.createBindGroup({
      layout: computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.springBuffer } },
        { binding: 2, resource: { buffer: this.simParamsBuffer } },
        { binding: 3, resource: { buffer: this.windParamsBuffer } },
        { binding: 4, resource: { buffer: this.mouseBuffer } },
        { binding: 5, resource: { buffer: this.sphereBuffer } },
        { binding: 6, resource: { buffer: this.selfCollisionBuffer } },
      ],
    });

    const renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: this.particleBuffer } },
        { binding: 2, resource: { buffer: this.springBuffer } },
        { binding: 3, resource: { buffer: this.renderParamsBuffer } },
      ],
    });

    this.computePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [computeBindGroupLayout],
    });

    this.renderPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
    });
  }

  private createPipelines(): void {
    const computeModule = this.device.createShaderModule({ code: computeShaderSource });

    this.pipelinePredict = this.device.createComputePipeline({
      layout: this.computePipelineLayout,
      compute: { module: computeModule, entryPoint: 'predictPositions' },
    });

    this.pipelineSolve = this.device.createComputePipeline({
      layout: this.computePipelineLayout,
      compute: { module: computeModule, entryPoint: 'solveConstraints' },
    });

    this.pipelineIntegrate = this.device.createComputePipeline({
      layout: this.computePipelineLayout,
      compute: { module: computeModule, entryPoint: 'integratePositions' },
    });

    this.pipelineTear = this.device.createComputePipeline({
      layout: this.computePipelineLayout,
      compute: { module: computeModule, entryPoint: 'tearSprings' },
    });

    this.pipelineSelfCollision = this.device.createComputePipeline({
      layout: this.computePipelineLayout,
      compute: { module: computeModule, entryPoint: 'solveSelfCollision' },
    });

    const renderModule = this.device.createShaderModule({ code: renderShaderSource });

    const blendState: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };

    this.pipelineTri = this.device.createRenderPipeline({
      layout: this.renderPipelineLayout,
      vertex: { module: renderModule, entryPoint: 'vs_tri_main', buffers: [] },
      fragment: {
        module: renderModule,
        entryPoint: 'fs_tri_main',
        targets: [{ format: this.format, blend: blendState }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      multisample: { count: 4 },
    });

    this.pipelineWire = this.device.createRenderPipeline({
      layout: this.renderPipelineLayout,
      vertex: { module: renderModule, entryPoint: 'vs_wire_main', buffers: [] },
      fragment: {
        module: renderModule,
        entryPoint: 'fs_wire_main',
        targets: [{ format: this.format, blend: blendState }],
      },
      primitive: { topology: 'triangle-strip', cullMode: 'none' },
      multisample: { count: 4 },
    });
  }

  private updateCamera(): void {
    const aspect = this.canvas.width / this.canvas.height;
    const proj = mat4Perspective(Math.PI / 4, aspect, 0.1, 100);
    const view = mat4LookAt(this.cameraPos, this.cameraTarget, [0, 1, 0]);
    this.viewProjMatrix = mat4Multiply(proj, view);
    this.viewProjInvMatrix = mat4Inverse(this.viewProjMatrix);

    if (!this.cameraBuffer) return;

    const cameraData = new Float32Array(CAMERA_SIZE / 4);
    cameraData.set(this.viewProjMatrix, 0);
    cameraData.set(this.cameraPos, 16);
    this.device.queue.writeBuffer(this.cameraBuffer, 0, cameraData);
  }

  private updateSimParams(): void {
    const data = new Float32Array(SIM_PARAMS_SIZE / 4);
    data[0] = this.simParams.structCompliance;
    data[1] = this.simParams.shearCompliance;
    data[2] = this.simParams.bendCompliance;
    data[3] = this.simParams.damping;
    data[4] = this.simParams.gravity[0];
    data[5] = this.simParams.gravity[1];
    data[6] = this.simParams.gravity[2];
    data[7] = this.simParams.deltaTime;

    const uintView = new Uint32Array(data.buffer);
    uintView[8] = this.simParams.numParticles;
    uintView[9] = this.simParams.numSprings;
    data[10] = this.simParams.globalBreakThreshold;
    uintView[11] = this.simParams.subSteps;

    this.device.queue.writeBuffer(this.simParamsBuffer, 0, data);
  }

  private updateWindParams(): void {
    const data = new Float32Array(WIND_PARAMS_SIZE / 4);
    data[0] = this.windParams.strength;
    data[1] = this.windParams.time;
    data[2] = this.windParams.frequency;
    data[4] = this.windParams.direction[0];
    data[5] = this.windParams.direction[1];
    data[6] = this.windParams.direction[2];
    this.device.queue.writeBuffer(this.windParamsBuffer, 0, data);
  }

  private updateMouseParams(): void {
    const data = new Float32Array(MOUSE_INTERACTION_SIZE / 4);
    const uintView = new Uint32Array(data.buffer);

    uintView[0] = this.mouse.mode;
    uintView[1] = this.mouse.active;
    uintView[2] = this.mouse.particleIndex;
    data[3] = this.mouse.radius;
    data[4] = this.mouse.worldPos[0];
    data[5] = this.mouse.worldPos[1];
    data[6] = this.mouse.worldPos[2];
    data[8] = this.mouse.force[0];
    data[9] = this.mouse.force[1];
    data[10] = this.mouse.force[2];

    this.device.queue.writeBuffer(this.mouseBuffer, 0, data);
  }

  private updateRenderParams(): void {
    const data = new Float32Array(RENDER_PARAMS_SIZE / 4);
    const uintView = new Uint32Array(data.buffer);

    uintView[0] = this.showStress ? 1 : 0;
    data[1] = this.maxTension;
    uintView[2] = GRID_SIZE;
    uintView[3] = this.structSpringCount;

    this.device.queue.writeBuffer(this.renderParamsBuffer, 0, data);
  }

  private updateSphereParams(): void {
    const data = new Float32Array((SPHERE_SIZE / 4) * MAX_SPHERES);
    for (let i = 0; i < MAX_SPHERES; i++) {
      const sphere = this.spheres[i];
      const offset = i * (SPHERE_SIZE / 4);
      data[offset + 0] = sphere.position[0];
      data[offset + 1] = sphere.position[1];
      data[offset + 2] = sphere.position[2];
      data[offset + 3] = sphere.radius;
    }
    this.device.queue.writeBuffer(this.sphereBuffer, 0, data);
  }

  private updateSelfCollisionParams(): void {
    const data = new Float32Array(SELF_COLLISION_SIZE / 4);
    const uintView = new Uint32Array(data.buffer);

    data[0] = this.selfCollisionParams.thickness;
    data[1] = this.selfCollisionParams.stiffness;
    uintView[2] = this.selfCollisionParams.enabled;

    this.device.queue.writeBuffer(this.selfCollisionBuffer, 0, data);
  }

  private pinCorners(): void {
    const corners = [
      getParticleIndex(0, 0),
      getParticleIndex(GRID_SIZE - 1, 0),
      getParticleIndex(0, GRID_SIZE - 1),
      getParticleIndex(GRID_SIZE - 1, GRID_SIZE - 1),
    ];

    const pinnedValue = this.pinnedCorners ? 1 : 0;
    const data = new Uint32Array(1);
    data[0] = pinnedValue;

    for (const idx of corners) {
      const byteOffset = idx * PARTICLE_SIZE + 52;
      this.device.queue.writeBuffer(this.particleBuffer, byteOffset, data);
    }
  }

  public setStructCompliance(value: number): void {
    this.simParams.structCompliance = value;
  }

  public setShearCompliance(value: number): void {
    this.simParams.shearCompliance = value;
  }

  public setBendCompliance(value: number): void {
    this.simParams.bendCompliance = value;
  }

  public setDamping(value: number): void {
    this.simParams.damping = value;
  }

  public setWindStrength(value: number): void {
    this.windParams.strength = value;
  }

  public setTearRadius(value: number): void {
    this.mouse.radius = value * 0.1;
  }

  public setBreakThreshold(value: number): void {
    this.simParams.globalBreakThreshold = value;
  }

  public setSubSteps(value: number): void {
    this.simParams.subSteps = value;
  }

  public setSpherePosition(index: number, x: number, y: number, z: number): void {
    if (index >= 0 && index < MAX_SPHERES) {
      this.spheres[index].position = [x, y, z];
    }
  }

  public setSphereRadius(index: number, radius: number): void {
    if (index >= 0 && index < MAX_SPHERES) {
      this.spheres[index].radius = radius;
    }
  }

  public setSelfCollisionThickness(value: number): void {
    this.selfCollisionParams.thickness = value;
  }

  public setSelfCollisionStiffness(value: number): void {
    this.selfCollisionParams.stiffness = value;
  }

  public toggleSelfCollision(): void {
    this.selfCollisionParams.enabled = this.selfCollisionParams.enabled ? 0 : 1;
  }

  public toggleSpheres(): void {
    this.showSpheres = !this.showSpheres;
  }

  public startExport(): void {
    this.exporting = true;
    this.exportFrame = true;
    this.exportFrameCount = 0;
    this.exportFrames = [];
  }

  public stopExport(): string[] {
    this.exporting = false;
    this.exportFrame = false;
    return this.exportFrames;
  }

  public isExporting(): boolean {
    return this.exporting;
  }

  public getExportFrameCount(): number {
    return this.exportFrameCount;
  }

  public setMouseMode(mode: MouseMode): void {
    this.mouse.mode = mode;
    this.mouse.active = 0;
    this.draggedParticle = -1;
    this.updateMouseParams();
  }

  public togglePinnedCorners(): void {
    this.pinnedCorners = !this.pinnedCorners;
    this.pinCorners();
  }

  public toggleStressView(): void {
    this.showStress = !this.showStress;
    this.updateRenderParams();
  }

  public toggleWireframe(): void {
    this.showWireframe = !this.showWireframe;
  }

  public reset(): void {
    const particleData = createParticles();
    const { data: springData, structCount } = createSprings();
    this.structSpringCount = structCount;

    this.device.queue.writeBuffer(this.particleBuffer, 0, particleData);
    this.device.queue.writeBuffer(this.springBuffer, 0, springData);

    this.windParams.time = 0;
    this.mouse.active = 0;
    this.draggedParticle = -1;

    this.pinCorners();
    this.updateMouseParams();
    this.updateRenderParams();
    this.updateSphereParams();
    this.updateSelfCollisionParams();
  }

  public handleMouseDown(screenX: number, screenY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left) * (this.canvas.width / rect.width);
    const y = (screenY - rect.top) * (this.canvas.height / rect.height);

    const worldPos = screenToWorld(x, y, this.canvas.width, this.canvas.height, this.viewProjInvMatrix, 0);
    this.mouse.worldPos = worldPos;

    if (this.mouse.mode === MOUSE_MODE.DRAG) {
      this.isDragging = true;
      this.draggedParticle = this.findNearestParticle(worldPos);
      this.mouse.particleIndex = this.draggedParticle;
      this.mouse.active = 1;
    } else if (this.mouse.mode === MOUSE_MODE.FORCE) {
      this.mouse.active = 1;
      this.mouse.force = [50, 50, 50];
    } else if (this.mouse.mode === MOUSE_MODE.TEAR) {
      this.mouse.active = 1;
    }

    this.updateMouseParams();
  }

  public handleMouseMove(screenX: number, screenY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left) * (this.canvas.width / rect.width);
    const y = (screenY - rect.top) * (this.canvas.height / rect.height);

    const worldPos = screenToWorld(x, y, this.canvas.width, this.canvas.height, this.viewProjInvMatrix, 0);
    this.mouse.worldPos = worldPos;

    if (this.isDragging && this.draggedParticle >= 0) {
      this.mouse.active = 1;
      this.updateMouseParams();
    } else if (this.mouse.mode === MOUSE_MODE.TEAR && this.mouse.active === 1) {
      this.updateMouseParams();
    }
  }

  public handleMouseUp(): void {
    this.isDragging = false;
    this.draggedParticle = -1;
    this.mouse.active = 0;
    this.updateMouseParams();
  }

  public handleWheel(deltaY: number): void {
    if (this.mouse.mode === MOUSE_MODE.FORCE) {
      const scale = deltaY > 0 ? 0.9 : 1.1;
      this.mouse.force = this.mouse.force.map((f) => Math.max(10, Math.min(200, f * scale))) as [number, number, number];
    }
  }

  private findNearestParticle(worldPos: [number, number, number]): number {
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const px = this.particleInitialPositions[i * 3];
      const py = this.particleInitialPositions[i * 3 + 1];
      const pz = this.particleInitialPositions[i * 3 + 2];

      const dx = px - worldPos[0];
      const dy = py - worldPos[1];
      const dz = pz - worldPos[2];
      const dist = dx * dx + dy * dy + dz * dz;

      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    return nearestIdx;
  }

  public start(): void {
    this.updateSimParams();
    this.updateRenderParams();
    this.lastTime = performance.now();
    this.animate();
  }

  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animate(): void {
    const now = performance.now();
    const deltaTime = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;

    this.frameCount++;
    if (now - this.fpsUpdateTime >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / (now - this.fpsUpdateTime));
      this.frameCount = 0;
      this.fpsUpdateTime = now;
      if (this.onFpsUpdate) {
        this.onFpsUpdate(this.fps);
      }
    }

    this.windParams.time += deltaTime;
    this.simParams.deltaTime = deltaTime;

    this.updateSimParams();
    this.updateWindParams();
    this.updateMouseParams();

    this.compute();
    this.render();

    if (this.exporting && this.exportFrame) {
      this.exportFrame = false;
      this.exportCurrentFrame().then((obj) => {
        this.exportFrames.push(obj);
        this.exportFrameCount++;
        this.exportFrame = true;
      });
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  private async exportCurrentFrame(): Promise<string> {
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(
      this.particleBuffer,
      0,
      this.readbackBuffer,
      0,
      PARTICLE_COUNT * PARTICLE_SIZE
    );
    this.device.queue.submit([encoder.finish()]);

    await this.readbackBuffer.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(this.readbackBuffer.getMappedRange());

    let obj = `# Cloth frame ${this.exportFrameCount}\n`;
    obj += `# ${PARTICLE_COUNT} vertices, ${2 * CELL_COUNT} faces\n\n`;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const offset = i * (PARTICLE_SIZE / 4);
      const x = data[offset + 0];
      const y = data[offset + 1];
      const z = data[offset + 2];
      obj += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
    }

    obj += '\n';

    for (let y = 0; y < GRID_SIZE - 1; y++) {
      for (let x = 0; x < GRID_SIZE - 1; x++) {
        const i00 = y * GRID_SIZE + x + 1;
        const i10 = y * GRID_SIZE + x + 2;
        const i01 = (y + 1) * GRID_SIZE + x + 1;
        const i11 = (y + 1) * GRID_SIZE + x + 2;

        obj += `f ${i00} ${i10} ${i11}\n`;
        obj += `f ${i00} ${i11} ${i01}\n`;
      }
    }

    this.readbackBuffer.unmap();

    return obj;
  }

  private compute(): void {
    const encoder = this.device.createCommandEncoder();
    const subSteps = this.simParams.subSteps;
    const subDt = this.simParams.deltaTime / subSteps;

    const savedDt = this.simParams.deltaTime;
    this.simParams.deltaTime = subDt;

    this.updateSphereParams();
    this.updateSelfCollisionParams();

    for (let s = 0; s < subSteps; s++) {
      const pass = encoder.beginComputePass();

      pass.setBindGroup(0, this.computeBindGroup);

      pass.setPipeline(this.pipelinePredict);
      pass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 64));

      const solverIterations = 4;
      for (let i = 0; i < solverIterations; i++) {
        pass.setPipeline(this.pipelineSolve);
        pass.dispatchWorkgroups(Math.ceil(this.springCount / 64));
      }

      if (this.selfCollisionParams.enabled) {
        pass.setPipeline(this.pipelineSelfCollision);
        pass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 64));
      }

      pass.setPipeline(this.pipelineIntegrate);
      pass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 64));

      pass.end();
    }

    this.simParams.deltaTime = savedDt;

    if (this.mouse.mode === MOUSE_MODE.TEAR && this.mouse.active === 1) {
      const tearPass = encoder.beginComputePass();
      tearPass.setBindGroup(0, this.computeBindGroup);
      tearPass.setPipeline(this.pipelineTear);
      tearPass.dispatchWorkgroups(Math.ceil(this.springCount / 64));
      tearPass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }

  private render(): void {
    const textureView = this.context.getCurrentTexture().createView();

    const multisampleTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      sampleCount: 4,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const encoder = this.device.createCommandEncoder();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: multisampleTexture.createView(),
          resolveTarget: textureView,
          clearValue: { r: 0.04, g: 0.04, b: 0.06, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setBindGroup(0, this.renderBindGroup);

    renderPass.setPipeline(this.pipelineTri);
    renderPass.draw(6, CELL_COUNT, 0, 0);

    if (this.showWireframe) {
      renderPass.setPipeline(this.pipelineWire);
      renderPass.draw(4, this.springCount, 0, 0);
    }

    renderPass.end();

    this.device.queue.submit([encoder.finish()]);

    multisampleTexture.destroy();
  }

  public getSpringCount(): number {
    return this.springCount;
  }

  public getParticleCount(): number {
    return PARTICLE_COUNT;
  }
}
