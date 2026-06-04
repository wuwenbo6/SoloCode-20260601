import { useEffect, useRef, useState, useCallback } from 'react';
import { ParticleSystem } from '../particles/ParticleSystem';
import { PerformanceMonitor } from '../ui/PerformanceMonitor';
import { ControlPanel } from '../ui/ControlPanel';
import { PresetParams, DEFAULT_PRESET_PARAMS, PerformanceMetrics } from '../types';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const destroyedRef = useRef(false);
  const [params, setParams] = useState<PresetParams>({ ...DEFAULT_PRESET_PARAMS });
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    particleCount: params.particleCount,
    renderedCount: params.particleCount,
    frameTime: 0,
    computeTime: 0,
    renderTime: 0,
  });
  const [webgpuSupported, setWebgpuSupported] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const handleMetricsUpdate = useCallback((newMetrics: PerformanceMetrics) => {
    setMetrics(newMetrics);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    destroyedRef.current = false;

    const canvas = canvasRef.current;
    const ps = new ParticleSystem(canvas, handleMetricsUpdate);
    particleSystemRef.current = ps;

    ps.init().then((success) => {
      if (destroyedRef.current) return;
      if (success) {
        ps.start();
        setInitialized(true);
      } else {
        setWebgpuSupported(false);
      }
    });

    const handleResize = () => {
      ps.resize();
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      ps.setMousePosition(e.clientX, e.clientY);
      ps.setMouseActive(true);
    };

    const handleMouseLeave = () => {
      ps.setMouseActive(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        ps.setMousePosition(e.touches[0].clientX, e.touches[0].clientY);
        ps.setMouseActive(true);
      }
    };

    const handleTouchEnd = () => {
      ps.setMouseActive(false);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      destroyedRef.current = true;
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      ps.destroy();
      particleSystemRef.current = null;
    };
  }, [handleMetricsUpdate]);

  const handleParamsChange = useCallback((newParams: Partial<PresetParams>) => {
    setParams((prev) => {
      const updated = { ...prev, ...newParams };
      if (particleSystemRef.current) {
        particleSystemRef.current.updateParams(newParams);
      }
      return updated;
    });
  }, []);

  const handleReset = useCallback(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.resetParticles();
    }
  }, []);

  const getParticleSystem = useCallback(() => {
    return particleSystemRef.current;
  }, []);

  if (!webgpuSupported) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">WebGPU 不可用</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            您的浏览器不支持 WebGPU。请使用最新版本的 Chrome (113+)、Edge (113+) 或 Safari (17+) 浏览器访问此页面。
          </p>
          <a
            href="https://caniuse.com/webgpu"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-cyan-400 text-xs hover:text-cyan-300 transition-colors"
          >
            查看浏览器兼容性 →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#0a0a0f] overflow-hidden relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        style={{ touchAction: 'none' }}
      />

      <PerformanceMonitor metrics={metrics} />

      {initialized && (
        <ControlPanel
          params={params}
          onParamsChange={handleParamsChange}
          onReset={handleReset}
          getParticleSystem={getParticleSystem}
        />
      )}

      {!initialized && webgpuSupported && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/80 z-[100]">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-cyan-400 text-sm font-mono">初始化 WebGPU...</p>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-4 z-50 text-zinc-600 font-mono" style={{ fontSize: '10px' }}>
        <span>移动鼠标产生斥力场</span>
      </div>
    </div>
  );
}
