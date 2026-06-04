import { useRef, useEffect, useCallback } from 'react';
import { useSimulationStore, DisplayMode, ObstacleShape, GridSize } from '../store/useSimulationStore';
import { LBM_D2Q9_SHADER, RENDER_SHADER } from '../shaders/shaders';

const D2Q9_WEIGHTS = [4/9, 1/9, 1/9, 1/9, 1/9, 1/36, 1/36, 1/36, 1/36];
const WORKGROUP_SIZE = 16;

interface SimulationResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  uniformBuffer: GPUBuffer;
  fBuffers: [GPUBuffer, GPUBuffer];
  macroBuffer: GPUBuffer;
  obstacleBuffer: GPUBuffer;
  collisionPipeline: GPUComputePipeline;
  streamPipeline: GPUComputePipeline;
  injectPipeline: GPUComputePipeline;
  obstaclePipeline: GPUComputePipeline;
  renderPipeline: GPURenderPipeline;
  renderUniformBuffer: GPUBuffer;
  bindGroup0: GPUBindGroup;
  bindGroup1: GPUBindGroup;
  injectBindGroup: GPUBindGroup;
  obstacleBindGroup: GPUBindGroup;
  renderBindGroup: GPUBindGroup;
  injectUniformBuffer: GPUBuffer;
  obstacleUniformBuffer: GPUBuffer;
  gridSize: GridSize;
}

export function useFluidSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resourcesRef = useRef<SimulationResources | null>(null);
  const animationRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const injectQueueRef = useRef<Array<{ x: number; y: number; ux: number; uy: number }>>([]);
  
  const {
    gridSize,
    displayMode,
    obstacleShape,
    obstacleSize,
    tau,
    injectionRadius,
    injectionDensity,
    injectionStrength,
    isRunning,
    setPerformance,
  } = useSimulationStore();

  const createInitialData = useCallback((size: GridSize) => {
    const initialFData = new Float32Array(size * size * 9);
    const initialMacroData = new Float32Array(size * size * 3);
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 3;
        initialMacroData[idx] = 1.0;
        initialMacroData[idx + 1] = 0.0;
        initialMacroData[idx + 2] = 0.0;

        for (let k = 0; k < 9; k++) {
          const fIdx = (y * size + x) * 9 + k;
          initialFData[fIdx] = D2Q9_WEIGHTS[k] * 1.0;
        }
      }
    }

    return { initialFData, initialMacroData };
  }, []);

  const initWebGPU = useCallback(async (canvas: HTMLCanvasElement, size: GridSize) => {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No GPU adapter found');
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu')!;
    const format = navigator.gpu.getPreferredCanvasFormat();

    canvas.width = size;
    canvas.height = size;

    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    const bufferSizeF = size * size * 9 * 4;
    const bufferSizeMacro = size * size * 3 * 4;
    const bufferSizeObstacle = size * size * 4;

    const uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const fBuffer0 = device.createBuffer({
      size: bufferSizeF,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const fBuffer1 = device.createBuffer({
      size: bufferSizeF,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const macroBuffer = device.createBuffer({
      size: bufferSizeMacro,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const obstacleBuffer = device.createBuffer({
      size: bufferSizeObstacle,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const { initialFData, initialMacroData } = createInitialData(size);

    device.queue.writeBuffer(fBuffer0, 0, initialFData);
    device.queue.writeBuffer(fBuffer1, 0, initialFData);
    device.queue.writeBuffer(macroBuffer, 0, initialMacroData);
    device.queue.writeBuffer(obstacleBuffer, 0, new Uint32Array(size * size).fill(0));

    const lbmModule = device.createShaderModule({ code: LBM_D2Q9_SHADER });
    const renderModule = device.createShaderModule({ code: RENDER_SHADER });

    const collisionPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: lbmModule, entryPoint: 'collisionMacro' },
    });

    const streamPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: lbmModule, entryPoint: 'stream' },
    });

    const injectPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: lbmModule, entryPoint: 'injectFluid' },
    });

    const obstaclePipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: lbmModule, entryPoint: 'updateObstacles' },
    });

    const renderPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: renderModule, entryPoint: 'vs_main' },
      fragment: {
        module: renderModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });

    const renderUniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const injectUniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const obstacleUniformBuffer = device.createBuffer({
      size: 24,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup0 = device.createBindGroup({
      layout: collisionPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: fBuffer0 } },
        { binding: 2, resource: { buffer: fBuffer1 } },
        { binding: 3, resource: { buffer: macroBuffer } },
        { binding: 4, resource: { buffer: obstacleBuffer } },
      ],
    });

    const bindGroup1 = device.createBindGroup({
      layout: collisionPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: fBuffer1 } },
        { binding: 2, resource: { buffer: fBuffer0 } },
        { binding: 3, resource: { buffer: macroBuffer } },
        { binding: 4, resource: { buffer: obstacleBuffer } },
      ],
    });

    const injectBindGroup = device.createBindGroup({
      layout: injectPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: injectUniformBuffer } }],
    });

    const obstacleBindGroup = device.createBindGroup({
      layout: obstaclePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: obstacleUniformBuffer } }],
    });

    const renderBindGroup = device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: renderUniformBuffer } },
        { binding: 1, resource: { buffer: macroBuffer } },
        { binding: 2, resource: { buffer: obstacleBuffer } },
      ],
    });

    const resources: SimulationResources = {
      device,
      context,
      uniformBuffer,
      fBuffers: [fBuffer0, fBuffer1] as [GPUBuffer, GPUBuffer],
      macroBuffer,
      obstacleBuffer,
      collisionPipeline,
      streamPipeline,
      injectPipeline,
      obstaclePipeline,
      renderPipeline,
      renderUniformBuffer,
      bindGroup0,
      bindGroup1,
      injectBindGroup,
      obstacleBindGroup,
      renderBindGroup,
      injectUniformBuffer,
      obstacleUniformBuffer,
      gridSize: size,
    };

    for (let i = 0; i < 3; i++) {
      const cx = size * (0.2 + i * 0.3);
      const cy = size * 0.5;
      for (let dx = -30; dx <= 30; dx++) {
        const x = Math.floor(cx + dx);
        if (x >= 0 && x < size) {
          const posData = new Float32Array([x, cy, 15, 0.3, 0.05, 0, 0, 0]);
          device.queue.writeBuffer(injectUniformBuffer, 0, posData);
          const workgroups = Math.ceil(size / WORKGROUP_SIZE);
          const encoder = device.createCommandEncoder();
          const computePass = encoder.beginComputePass();
          computePass.setPipeline(injectPipeline);
          computePass.setBindGroup(0, injectBindGroup);
          computePass.dispatchWorkgroups(workgroups, workgroups);
          computePass.end();
          device.queue.submit([encoder.finish()]);
        }
      }
    }

    return resources;
  }, [createInitialData]);

  const step = useCallback((resources: SimulationResources, time: number) => {
    const {
      device,
      uniformBuffer,
      collisionPipeline,
      streamPipeline,
      bindGroup0,
      gridSize,
    } = resources;

    const uniformData = new Float32Array([gridSize, tau, 1.0 / tau, time]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const workgroups = Math.ceil(gridSize / WORKGROUP_SIZE);

    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(collisionPipeline);
    computePass.setBindGroup(0, bindGroup0);
    computePass.dispatchWorkgroups(workgroups, workgroups);
    computePass.end();

    const streamPass = encoder.beginComputePass();
    streamPass.setPipeline(streamPipeline);
    streamPass.setBindGroup(0, bindGroup0);
    streamPass.dispatchWorkgroups(workgroups, workgroups);
    streamPass.end();

    device.queue.submit([encoder.finish()]);
  }, [tau]);

  const render = useCallback((resources: SimulationResources) => {
    const {
      device,
      context,
      renderPipeline,
      renderBindGroup,
      renderUniformBuffer,
      gridSize,
    } = resources;

    const displayModeValue = displayMode === 'velocity' ? 0 : displayMode === 'density' ? 1 : 2;
    const renderUniformData = new Float32Array([gridSize, displayModeValue, 50.0, 0]);
    device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformData);

    const encoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.02, g: 0.05, b: 0.08, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(6);
    renderPass.end();

    device.queue.submit([encoder.finish()]);
  }, [displayMode]);

  const injectFluid = useCallback((resources: SimulationResources, x: number, y: number, ux: number, uy: number) => {
    const {
      device,
      injectPipeline,
      injectBindGroup,
      injectUniformBuffer,
      gridSize,
    } = resources;

    const injectData = new Float32Array([x, y, injectionRadius, injectionDensity, ux, uy, 0, 0]);
    device.queue.writeBuffer(injectUniformBuffer, 0, injectData);

    const workgroups = Math.ceil(gridSize / WORKGROUP_SIZE);
    const encoder = device.createCommandEncoder();
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(injectPipeline);
    computePass.setBindGroup(0, injectBindGroup);
    computePass.dispatchWorkgroups(workgroups, workgroups);
    computePass.end();
    device.queue.submit([encoder.finish()]);
  }, [injectionRadius, injectionDensity]);

  const addObstacle = useCallback((resources: SimulationResources, x: number, y: number, shape: ObstacleShape, add: boolean) => {
    const {
      device,
      obstaclePipeline,
      obstacleBindGroup,
      obstacleUniformBuffer,
      gridSize,
    } = resources;

    const shapeValue = shape === 'circle' ? 0 : 1;
    const obstacleData = new Float32Array([x, y, obstacleSize, shapeValue, add ? 1 : 0, 0, 0, 0]);
    device.queue.writeBuffer(obstacleUniformBuffer, 0, obstacleData);

    const workgroups = Math.ceil(gridSize / WORKGROUP_SIZE);
    const encoder = device.createCommandEncoder();
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(obstaclePipeline);
    computePass.setBindGroup(0, obstacleBindGroup);
    computePass.dispatchWorkgroups(workgroups, workgroups);
    computePass.end();
    device.queue.submit([encoder.finish()]);
  }, [obstacleSize]);

  const clearObstacles = useCallback(async () => {
    if (!resourcesRef.current) return;

    const { device, obstacleBuffer, macroBuffer, fBuffers, gridSize } = resourcesRef.current;
    
    const clearObstaclesArr = new Uint32Array(gridSize * gridSize).fill(0);
    device.queue.writeBuffer(obstacleBuffer, 0, clearObstaclesArr);

    const { initialFData, initialMacroData } = createInitialData(gridSize);

    device.queue.writeBuffer(macroBuffer, 0, initialMacroData);
    device.queue.writeBuffer(fBuffers[0], 0, initialFData);
    device.queue.writeBuffer(fBuffers[1], 0, initialFData);
  }, [createInitialData]);

  const resetSimulation = useCallback(async () => {
    if (!resourcesRef.current) return;

    const { device, macroBuffer, fBuffers, obstacleBuffer, gridSize } = resourcesRef.current;

    const { initialFData, initialMacroData } = createInitialData(gridSize);
    const clearObstaclesArr = new Uint32Array(gridSize * gridSize).fill(0);

    device.queue.writeBuffer(macroBuffer, 0, initialMacroData);
    device.queue.writeBuffer(fBuffers[0], 0, initialFData);
    device.queue.writeBuffer(fBuffers[1], 0, initialFData);
    device.queue.writeBuffer(obstacleBuffer, 0, clearObstaclesArr);
  }, [createInitialData]);

  const getGridPosition = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !resourcesRef.current) return null;

    const rect = canvas.getBoundingClientRect();
    const size = resourcesRef.current.gridSize;
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = size - (clientY - rect.top) * scaleY;

    return { x, y };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resourcesRef.current) return;

    const pos = getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    if (isDraggingRef.current && e.shiftKey) {
      addObstacle(resourcesRef.current, pos.x, pos.y, obstacleShape, true);
    } else if (lastMousePosRef.current) {
      const dx = pos.x - lastMousePosRef.current.x;
      const dy = pos.y - lastMousePosRef.current.y;
      const speed = Math.sqrt(dx * dx + dy * dy);
      
      if (speed > 0.5) {
        injectQueueRef.current.push({
          x: pos.x,
          y: pos.y,
          ux: dx * injectionStrength,
          uy: dy * injectionStrength,
        });
      }
    }

    lastMousePosRef.current = pos;
  }, [getGridPosition, addObstacle, obstacleShape, injectionStrength]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    isDraggingRef.current = true;
    const pos = getGridPosition(e.clientX, e.clientY);
    if (pos && resourcesRef.current) {
      if (e.shiftKey) {
        addObstacle(resourcesRef.current, pos.x, pos.y, obstacleShape, true);
      }
      lastMousePosRef.current = pos;
    }
  }, [getGridPosition, addObstacle, obstacleShape]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    lastMousePosRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    lastMousePosRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const pos = getGridPosition(e.clientX, e.clientY);
    if (pos && resourcesRef.current) {
      addObstacle(resourcesRef.current, pos.x, pos.y, obstacleShape, false);
    }
  }, [getGridPosition, addObstacle, obstacleShape]);

  useEffect(() => {
    let time = 0;
    let pingPong = 0;

    const animate = async () => {
      if (!resourcesRef.current || !isRunning) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const frameStart = performance.now();

      while (injectQueueRef.current.length > 0) {
        const inject = injectQueueRef.current.shift()!;
        injectFluid(resourcesRef.current, inject.x, inject.y, inject.ux, inject.uy);
      }

      step(resourcesRef.current, time);
      render(resourcesRef.current);

      pingPong = 1 - pingPong;
      time += 1;

      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsUpdateRef.current >= 500) {
        const size = resourcesRef.current.gridSize;
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
        const iterationTime = (now - frameStart).toFixed(2);
        const gpuMemory = (size * size * (9 * 4 + 3 * 4 + 4)) / (1024 * 1024);
        setPerformance(fps, parseFloat(iterationTime), parseFloat(gpuMemory.toFixed(2)));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isRunning, step, render, injectFluid, setPerformance]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (resourcesRef.current) {
      resourcesRef.current.device.destroy();
      resourcesRef.current = null;
    }
    injectQueueRef.current = [];

    initWebGPU(canvas, gridSize).then((resources) => {
      resourcesRef.current = resources;
    }).catch((err) => {
      console.error('Failed to initialize WebGPU:', err);
    });

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gridSize, initWebGPU, handleMouseMove, handleMouseDown, handleMouseUp, handleMouseLeave, handleContextMenu]);

  const readObstacleBuffer = useCallback(async (): Promise<Uint32Array> => {
    if (!resourcesRef.current) return new Uint32Array(0);

    const { device, obstacleBuffer, gridSize } = resourcesRef.current;
    const size = gridSize * gridSize;
    const readBuffer = device.createBuffer({
      size: size * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(obstacleBuffer, 0, readBuffer, 0, size * 4);
    device.queue.submit([encoder.finish()]);

    await device.queue.onSubmittedWorkDone();

    await readBuffer.mapAsync(GPUMapMode.READ);
    const data = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();
    readBuffer.destroy();

    return data;
  }, []);

  return {
    canvasRef,
    clearObstacles,
    resetSimulation,
    gridSize,
    readObstacleBuffer,
  };
}
