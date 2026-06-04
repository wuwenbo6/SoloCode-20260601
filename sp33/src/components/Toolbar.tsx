import { RefreshCw, Download, RotateCcw, Camera, FileImage } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

interface ToolbarProps {
  onResetCamera: () => void;
  onSaveImage: () => void;
  onSaveHDRImage: () => void;
}

export function Toolbar({ onResetCamera, onSaveImage, onSaveHDRImage }: ToolbarProps) {
  const { resetRenderStats } = useAppStore();

  const handleResetSamples = () => {
    resetRenderStats();
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      <div className="bg-black/60 backdrop-blur-xl rounded-lg border border-white/10 p-1 flex items-center gap-1">
        <button
          onClick={onResetCamera}
          className="p-2 rounded-md hover:bg-white/10 transition-colors group"
          title="重置相机"
        >
          <RotateCcw className="w-4 h-4 text-white/70 group-hover:text-white" />
        </button>

        <div className="w-px h-6 bg-white/10" />

        <button
          onClick={handleResetSamples}
          className="p-2 rounded-md hover:bg-white/10 transition-colors group"
          title="重新渲染"
        >
          <RefreshCw className="w-4 h-4 text-white/70 group-hover:text-white" />
        </button>

        <div className="w-px h-6 bg-white/10" />

        <button
          onClick={onSaveImage}
          className="p-2 rounded-md hover:bg-white/10 transition-colors group"
          title="保存PNG"
        >
          <Download className="w-4 h-4 text-white/70 group-hover:text-white" />
        </button>

        <div className="w-px h-6 bg-white/10" />

        <button
          onClick={onSaveHDRImage}
          className="p-2 rounded-md hover:bg-white/10 transition-colors group"
          title="保存EXR (HDR)"
        >
          <FileImage className="w-4 h-4 text-amber-400 group-hover:text-amber-300" />
        </button>
      </div>

      <div className="bg-black/60 backdrop-blur-xl rounded-lg border border-white/10 px-3 py-2 flex items-center gap-2">
        <Camera className="w-4 h-4 text-blue-400" />
        <span className="text-xs text-white/80 font-medium">WebGPU 光线追踪器</span>
      </div>
    </div>
  );
}
