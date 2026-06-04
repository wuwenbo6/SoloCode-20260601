import { useEffect, useRef } from 'react';
import { Download, Printer as PrinterIcon } from 'lucide-react';
import { renderToCanvas, downloadAsImage, printAsImage } from '../utils/canvasPreview';

interface PrintPreviewProps {
  content: string;
  width?: number;
  scale?: number;
}

export default function PrintPreview({ content, width = 58, scale = 1 }: PrintPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (canvasRef.current && content) {
      renderToCanvas(canvasRef.current, content, { width });
    }
  }, [content, width]);

  const handleDownload = () => {
    if (canvasRef.current) {
      downloadAsImage(canvasRef.current);
    }
  };

  const handlePrint = () => {
    if (canvasRef.current) {
      printAsImage(canvasRef.current);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">打印预览</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <PrinterIcon className="w-4 h-4" />
            打印图片
          </button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="p-6 bg-slate-100 overflow-auto flex justify-center"
        style={{ maxHeight: '600px' }}
      >
        <div 
          className="shadow-2xl rounded-sm overflow-hidden transition-transform duration-300"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        >
          <canvas
            ref={canvasRef}
            className="block"
          />
        </div>
      </div>
    </div>
  );
}
