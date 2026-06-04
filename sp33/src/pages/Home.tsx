import { useEffect, useRef } from 'react';
import { useRenderer } from '../hooks/useRenderer.js';
import { ControlPanel } from '../components/ControlPanel.js';
import { StatusBar } from '../components/StatusBar.js';
import { Toolbar } from '../components/Toolbar.js';
import { useAppStore } from '../store/useAppStore.js';
import type { ModelInfo, MaterialPreset } from '../../shared/types.js';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    resetCamera, saveImage, saveHDRImage, webgpuSupported } = useRenderer({
      canvasRef,
      containerRef,
    });

  const { error, setModels, setMaterials, setError } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [modelsRes, materialsRes] = await Promise.all([
          fetch('/api/models'),
          fetch('/api/materials'),
        ]);

        if (!modelsRes.ok || !materialsRes.ok) {
          throw new Error('Failed to load data');
        }

        const modelsData = await modelsRes.json();
        const materialsData = await materialsRes.json();

        if (isMounted) {
          setModels(modelsData.models as ModelInfo[]);
          setMaterials(materialsData.materials as MaterialPreset[]);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [setModels, setMaterials]);

  if (!webgpuSupported) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">WebGPU 不支持</h1>
          <p className="text-white/60 mb-6">
            {error || '您的浏览器不支持 WebGPU。请使用 Chrome 113+ 或 Edge 113+ 浏览器，并确保 WebGPU 功能已启用。'}
          </p>
          <div className="bg-white/5 rounded-lg p-4 text-left">
            <p className="text-sm text-white/50 mb-2">启用步骤：</p>
            <ol className="text-sm text-white/40 space-y-1 list-decimal list-inside">
              <li>在地址栏输入 chrome://flags</li>
              <li>搜索 "WebGPU"</li>
              <li>将 "Unsafe WebGPU" 设置为 "Enabled"</li>
              <li>重启浏览器</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full h-screen"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        <ControlPanel />
        <Toolbar onResetCamera={resetCamera} onSaveImage={saveImage} onSaveHDRImage={saveHDRImage} />
        <StatusBar />

        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm z-20">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
