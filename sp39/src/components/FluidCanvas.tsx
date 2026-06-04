import { useRef, useEffect, useCallback } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { usePathPlanningStore, findPath, createRobot, updateRobot } from '../store/usePathPlanningStore';
import { useVideoRecorder } from '../hooks/useVideoRecorder';
import { PathPlanningPanel, RecordingPanel } from './PathPlanningPanel';
import { useFluidSimulation } from '../hooks/useFluidSimulation';

export function FluidCanvas() {
  const { gridSize } = useSimulationStore();
  const { canvasRef, clearObstacles, resetSimulation, readObstacleBuffer } = useFluidSimulation();
  const {
    mode,
    setMode,
    robots,
    addRobot,
    updateRobotState,
    pendingStart,
    setPendingStart,
  } = usePathPlanningStore();

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const robotAnimRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  const videoRecorder = useVideoRecorder();

  const handleReset = () => {
    resetSimulation();
  };

  const handleClearObstacles = () => {
    clearObstacles();
  };

  const getGridPositionFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = gridSize / rect.width;
    const scaleY = gridSize / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = gridSize - (e.clientY - rect.top) * scaleY;

    return { x, y };
  }, [canvasRef, gridSize]);

  const handleOverlayClick = useCallback(async (e: React.MouseEvent) => {
    const pos = getGridPositionFromEvent(e);
    if (!pos) return;

    if (mode === 'setStart') {
      usePathPlanningStore.setState({ pendingStart: { x: pos.x, y: pos.y } });
      setMode('setTarget');
    } else if (mode === 'setTarget') {
      const start = pendingStart;
      if (!start) {
        setMode('setStart');
        return;
      }

      const obstacleData = await readObstacleBuffer();
      const path = findPath(start, pos, obstacleData, gridSize);

      if (path.length > 0) {
        const id = Math.random().toString(36).substring(2, 8);
        const robot = createRobot(id, start.x, start.y, pos.x, pos.y, robots.length);
        robot.path = path;
        addRobot(robot);
      }

      usePathPlanningStore.setState({ pendingStart: null });
      setMode('none');
    }
  }, [mode, pendingStart, setMode, addRobot, robots.length, getGridPositionFromEvent, gridSize, readObstacleBuffer]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!overlay || !mainCanvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = mainCanvas.getBoundingClientRect();
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.width = Math.floor(rect.width * window.devicePixelRatio);
      overlay.height = Math.floor(rect.height * window.devicePixelRatio);
    });

    resizeObserver.observe(mainCanvas);
    return () => resizeObserver.disconnect();
  }, [canvasRef]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!overlay || !mainCanvas) return;

    const drawRobots = () => {
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const rect = mainCanvas.getBoundingClientRect();
      const scaleX = rect.width / gridSize;
      const scaleY = rect.height / gridSize;

      const toScreen = (gx: number, gy: number) => ({
        sx: gx * scaleX,
        sy: rect.height - gy * scaleY,
      });

      for (const robot of robots) {
        if (robot.path.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = robot.color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.4;
          ctx.setLineDash([4, 4]);

          const first = toScreen(robot.path[0].x, robot.path[0].y);
          ctx.moveTo(first.sx, first.sy);

          for (let i = 1; i < robot.path.length; i++) {
            const pt = toScreen(robot.path[i].x, robot.path[i].y);
            ctx.lineTo(pt.sx, pt.sy);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        if (robot.trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = robot.color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;

          const trailStart = toScreen(robot.trail[0].x, robot.trail[0].y);
          ctx.moveTo(trailStart.sx, trailStart.sy);

          for (let i = 1; i < robot.trail.length; i++) {
            const pt = toScreen(robot.trail[i].x, robot.trail[i].y);
            ctx.lineTo(pt.sx, pt.sy);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        const pos = toScreen(robot.x, robot.y);
        const targetPos = toScreen(robot.targetX, robot.targetY);

        if (!robot.arrived) {
          ctx.beginPath();
          ctx.arc(targetPos.sx, targetPos.sy, 6, 0, Math.PI * 2);
          ctx.strokeStyle = robot.color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(targetPos.sx - 3, targetPos.sy);
          ctx.lineTo(targetPos.sx + 3, targetPos.sy);
          ctx.moveTo(targetPos.sx, targetPos.sy - 3);
          ctx.lineTo(targetPos.sx, targetPos.sy + 3);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        const radius = robot.arrived ? 5 : 7;
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = robot.color;
        ctx.globalAlpha = robot.arrived ? 0.5 : 0.9;
        ctx.fill();

        if (!robot.arrived) {
          ctx.beginPath();
          ctx.arc(pos.sx, pos.sy, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = robot.color;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.stroke();
        }

        ctx.globalAlpha = 1;

        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = robot.color;
        ctx.globalAlpha = 0.8;
        ctx.fillText(robot.name, pos.sx + 10, pos.sy - 4);
        ctx.globalAlpha = 1;
      }

      if (pendingStart) {
        const pos = toScreen(pendingStart.x, pendingStart.y);
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88';
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00ff88';
        ctx.fillText('START', pos.sx + 12, pos.sy - 4);
      }

      if (mode === 'setTarget') {
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ff6b35';
        ctx.globalAlpha = 0.8;
        ctx.fillText('Click to set TARGET', 10, rect.height - 10);
        ctx.globalAlpha = 1;
      } else if (mode === 'setStart') {
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00ff88';
        ctx.globalAlpha = 0.8;
        ctx.fillText('Click to set START', 10, rect.height - 10);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    };

    const animateRobots = () => {
      const now = performance.now();
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      for (const robot of robots) {
        if (robot.active && !robot.arrived) {
          const updated = updateRobot(robot, dt);
          updateRobotState(robot.id, updated);
        }
      }

      drawRobots();
      robotAnimRef.current = requestAnimationFrame(animateRobots);
    };

    robotAnimRef.current = requestAnimationFrame(animateRobots);

    return () => {
      cancelAnimationFrame(robotAnimRef.current);
    };
  }, [canvasRef, gridSize, robots, mode, pendingStart, updateRobotState]);

  const handleStartRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      videoRecorder.startRecording(canvas);
    }
  }, [canvasRef, videoRecorder]);

  const handleDownload = useCallback(() => {
    if (videoRecorder.recordedUrl) {
      const a = document.createElement('a');
      a.href = videoRecorder.recordedUrl;
      a.download = `fluid-sim-${Date.now()}.webm`;
      a.click();
    }
  }, [videoRecorder.recordedUrl]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
      <div className="relative max-w-[min(90vw,90vh)] max-h-[min(90vw,90vh)]">
        <canvas
          ref={canvasRef}
          className="w-auto h-auto border border-cyan-500/20 rounded-lg shadow-2xl shadow-cyan-500/5"
          style={{ imageRendering: 'pixelated' }}
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-auto"
          onClick={handleOverlayClick}
          style={{ cursor: mode !== 'none' ? 'crosshair' : 'default' }}
        />
      </div>

      <PathPlanningPanel />

      <RecordingPanel
        isRecording={videoRecorder.isRecording}
        recordedUrl={videoRecorder.recordedUrl}
        isPlaying={videoRecorder.isPlaying}
        playbackProgress={videoRecorder.playbackProgress}
        onStartRecording={handleStartRecording}
        onStopRecording={videoRecorder.stopRecording}
        onClearRecording={videoRecorder.clearRecording}
        onStartPlayback={videoRecorder.startPlayback}
        onStopPlayback={videoRecorder.stopPlayback}
        videoRef={videoRecorder.videoRef}
        onDownload={handleDownload}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <h1 className="font-mono text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          LBM D2Q9 FLUID SIMULATOR
        </h1>
        <p className="font-mono text-xs text-slate-500 mt-1">
          WebGPU Compute Shader • {gridSize}×{gridSize} Grid
        </p>
      </div>

      <div className="hidden">
        <button onClick={handleReset}>reset</button>
        <button onClick={handleClearObstacles}>clear</button>
      </div>
    </div>
  );
}
