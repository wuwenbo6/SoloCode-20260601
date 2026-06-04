import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, RotateCcw, Layers, Ruler, Clock, FileText } from 'lucide-react';
import { cn } from '../utils';
import { gcodeAPI } from '../services/api';
import type { GCodePreview as GCodePreviewData } from '../types';

const CANVAS_PADDING = 50;

function getLayerColor(layer: number, totalLayers: number): string {
  if (totalLayers <= 1) return 'hsl(200, 80%, 55%)';
  const hue = (layer / totalLayers) * 360;
  return `hsl(${hue}, 80%, 55%)`;
}

export function GCodePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<GCodePreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [layerMin, setLayerMin] = useState(0);
  const [layerMax, setLayerMax] = useState(0);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const maxLayer = preview ? preview.layer_count - 1 : 0;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !preview) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, w, h);

    const { bounds } = preview;
    const rangeX = bounds.max_x - bounds.min_x || 1;
    const rangeY = bounds.max_y - bounds.min_y || 1;

    const drawW = w - CANVAS_PADDING * 2;
    const drawH = h - CANVAS_PADDING * 2;
    const scale = Math.min(drawW / rangeX, drawH / rangeY);

    const offsetX = CANVAS_PADDING + (drawW - rangeX * scale) / 2;
    const offsetY = CANVAS_PADDING + (drawH - rangeY * scale) / 2;

    const toCanvasX = (x: number) => offsetX + (x - bounds.min_x) * scale;
    const toCanvasY = (y: number) => offsetY + (rangeY - (y - bounds.min_y)) * scale;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const gridStep = Math.pow(10, Math.floor(Math.log10(Math.max(rangeX, rangeY) / 5)));
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let x = Math.ceil(bounds.min_x / gridStep) * gridStep; x <= bounds.max_x; x += gridStep) {
      const cx = toCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(cx, CANVAS_PADDING);
      ctx.lineTo(cx, h - CANVAS_PADDING);
      ctx.stroke();
      ctx.fillText(x.toFixed(0), cx, h - CANVAS_PADDING + 4);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(bounds.min_y / gridStep) * gridStep; y <= bounds.max_y; y += gridStep) {
      const cy = toCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(CANVAS_PADDING, cy);
      ctx.lineTo(w - CANVAS_PADDING, cy);
      ctx.stroke();
      ctx.fillText(y.toFixed(0), CANVAS_PADDING - 4, cy);
    }

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('X', w / 2, h - 14);
    ctx.save();
    ctx.translate(14, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Y', 0, 0);
    ctx.restore();

    const visibleSegments = preview.segments.filter(
      (seg) => seg.layer >= layerMin && seg.layer <= layerMax
    );

    const travelMoves = visibleSegments.filter((seg) => !seg.extrude);
    const extrudeMoves = visibleSegments.filter((seg) => seg.extrude);

    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#d1d5db';
    for (const seg of travelMoves) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(seg.from_x), toCanvasY(seg.from_y));
      ctx.lineTo(toCanvasX(seg.to_x), toCanvasY(seg.to_y));
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.lineWidth = 1.2;

    const layersInView = new Set(extrudeMoves.map((s) => s.layer));
    const sortedLayers = Array.from(layersInView).sort((a, b) => a - b);
    const layerColorMap = new Map<number, string>();
    sortedLayers.forEach((layer, idx) => {
      layerColorMap.set(layer, getLayerColor(idx, sortedLayers.length));
    });

    for (const seg of extrudeMoves) {
      ctx.strokeStyle = layerColorMap.get(seg.layer) || 'hsl(200, 80%, 55%)';
      ctx.beginPath();
      ctx.moveTo(toCanvasX(seg.from_x), toCanvasY(seg.from_y));
      ctx.lineTo(toCanvasX(seg.to_x), toCanvasY(seg.to_y));
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }, [preview, layerMin, layerMax]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const handleResize = () => drawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  useEffect(() => {
    if (!playing || !preview) return;

    const interval = setInterval(() => {
      setCurrentLayer((prev) => {
        const next = prev + 1;
        if (next > maxLayer) {
          setPlaying(false);
          return maxLayer;
        }
        setLayerMax(next);
        return next;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [playing, preview, maxLayer]);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gcode')) {
      setError('请上传 .gcode 文件');
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setPlaying(false);

    try {
      const result = await gcodeAPI.upload(file);
      const data = result.preview;
      setPreview(data);
      setLayerMin(0);
      setLayerMax(data.layer_count - 1);
      setCurrentLayer(data.layer_count - 1);
    } catch {
      setError('解析 G-code 文件失败，请检查文件格式');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handlePlayPause = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (currentLayer >= maxLayer) {
        setLayerMax(0);
        setCurrentLayer(0);
      }
      setPlaying(true);
    }
  };

  const handleReset = () => {
    setPlaying(false);
    if (preview) {
      setLayerMin(0);
      setLayerMax(preview.layer_count - 1);
      setCurrentLayer(preview.layer_count - 1);
    }
  };

  const handleLayerSlider = (value: number) => {
    setPlaying(false);
    setCurrentLayer(value);
    setLayerMax(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">G-code 预览</h3>
        {fileName && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg">
            <FileText className="w-4 h-4" />
            <span>{fileName}</span>
          </div>
        )}
      </div>

      {!preview && !loading && (
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 font-medium">拖放 .gcode 文件到此处</p>
          <p className="text-gray-400 text-sm mt-1">或点击选择文件</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gcode"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">正在解析 G-code...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {preview && !loading && (
        <>
          <div ref={containerRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: '420px' }}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  playing
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                )}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {playing ? '暂停' : '播放'}
              </button>

              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>

              <div className="flex items-center gap-2 ml-auto text-sm text-gray-600">
                <Layers className="w-4 h-4" />
                <span>层 {currentLayer} / {maxLayer}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 w-8">0</span>
              <input
                type="range"
                min={0}
                max={maxLayer}
                value={currentLayer}
                onChange={(e) => handleLayerSlider(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm text-gray-500 w-8 text-right">{maxLayer}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">总段数</span>
              </div>
              <span className="text-2xl font-bold text-gray-800">
                {preview.total_lines.toLocaleString()}
              </span>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Layers className="w-4 h-4" />
                <span className="text-sm font-medium">层数</span>
              </div>
              <span className="text-2xl font-bold text-gray-800">
                {preview.layer_count}
              </span>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Ruler className="w-4 h-4" />
                <span className="text-sm font-medium">耗材</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-800">
                  {preview.filament_mm.toFixed(1)}
                </span>
                <span className="text-gray-500 text-sm">mm</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">预估时间</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-800">
                  {preview.est_time_min.toFixed(0)}
                </span>
                <span className="text-gray-500 text-sm">min</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            更换文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gcode"
            onChange={handleInputChange}
            className="hidden"
          />
        </>
      )}
    </div>
  );
}
