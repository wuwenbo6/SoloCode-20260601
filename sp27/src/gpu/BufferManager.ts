import { PARTICLE_SIZE, FORCE_FIELD_SIZE, RENDER_PARAMS_SIZE, BOIDS_SIZE } from '../types';

export class BufferManager {
  private device: GPUDevice;
  private particleCount: number;
  private particleBuffer0!: GPUBuffer;
  private particleBuffer1!: GPUBuffer;
  private forceFieldUniformBuffer!: GPUBuffer;
  private boidsUniformBuffer!: GPUBuffer;
  private renderParamsUniformBuffer!: GPUBuffer;

  constructor(device: GPUDevice, particleCount: number) {
    this.device = device;
    this.particleCount = particleCount;
    this.createBuffers();
  }

  private createBuffers(): void {
    const particleBufferSize = this.particleCount * PARTICLE_SIZE;

    this.particleBuffer0 = this.device.createBuffer({
      size: particleBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: false,
    });

    this.particleBuffer1 = this.device.createBuffer({
      size: particleBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: false,
    });

    this.forceFieldUniformBuffer = this.device.createBuffer({
      size: FORCE_FIELD_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.boidsUniformBuffer = this.device.createBuffer({
      size: BOIDS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.renderParamsUniformBuffer = this.device.createBuffer({
      size: RENDER_PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  public uploadInitialParticles(data: Float32Array): void {
    this.device.queue.writeBuffer(this.particleBuffer0, 0, data);
    this.device.queue.writeBuffer(this.particleBuffer1, 0, data);
  }

  public writeForceFieldParams(data: Float32Array): void {
    this.device.queue.writeBuffer(this.forceFieldUniformBuffer, 0, data);
  }

  public writeBoidsParams(data: Float32Array): void {
    this.device.queue.writeBuffer(this.boidsUniformBuffer, 0, data);
  }

  public writeRenderParams(data: Float32Array): void {
    this.device.queue.writeBuffer(this.renderParamsUniformBuffer, 0, data);
  }

  public getParticleBuffer0(): GPUBuffer {
    return this.particleBuffer0;
  }

  public getParticleBuffer1(): GPUBuffer {
    return this.particleBuffer1;
  }

  public getForceFieldUniformBuffer(): GPUBuffer {
    return this.forceFieldUniformBuffer;
  }

  public getBoidsUniformBuffer(): GPUBuffer {
    return this.boidsUniformBuffer;
  }

  public getRenderParamsUniformBuffer(): GPUBuffer {
    return this.renderParamsUniformBuffer;
  }

  public getCurrentReadBuffer(swapCount: number): GPUBuffer {
    return swapCount % 2 === 0 ? this.particleBuffer1 : this.particleBuffer0;
  }

  public swapParticleBuffers(): void {
    const temp = this.particleBuffer0;
    this.particleBuffer0 = this.particleBuffer1;
    this.particleBuffer1 = temp;
  }

  public resize(particleCount: number): void {
    this.particleCount = particleCount;
    this.particleBuffer0.destroy();
    this.particleBuffer1.destroy();
    this.createBuffers();
  }

  public destroy(): void {
    this.particleBuffer0.destroy();
    this.particleBuffer1.destroy();
    this.forceFieldUniformBuffer.destroy();
    this.boidsUniformBuffer.destroy();
    this.renderParamsUniformBuffer.destroy();
  }
}
