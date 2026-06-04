import { useState, useCallback, useRef } from 'react';
import { Upload, FileVideo, X, Plus } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { formatFileSize } from '../utils/format.js';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  disabled?: boolean;
}

export const FileUpload = ({ onFilesSelect, selectedFiles, disabled }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filterMp4Files = (files: FileList): File[] => {
    const result: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'video/mp4' || file.name.endsWith('.mp4')) {
        result.push(file);
      }
    }
    return result;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = e.dataTransfer.files;
      const mp4Files = filterMp4Files(files);
      if (mp4Files.length > 0) {
        onFilesSelect([...selectedFiles, ...mp4Files]);
      }
    },
    [onFilesSelect, selectedFiles, disabled]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const mp4Files = filterMp4Files(files);
        onFilesSelect([...selectedFiles, ...mp4Files]);
      }
    },
    [onFilesSelect, selectedFiles]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const newFiles = [...selectedFiles];
      newFiles.splice(index, 1);
      onFilesSelect(newFiles);
    },
    [onFilesSelect, selectedFiles]
  );

  const handleClearAll = useCallback(() => {
    onFilesSelect([]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onFilesSelect]);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 transition-all duration-300 cursor-pointer',
          'bg-slate-800/50 backdrop-blur-sm',
          isDragging && !disabled
            ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
            : selectedFiles.length > 0
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-slate-600 hover:border-cyan-500/50 hover:bg-slate-700/30',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,video/mp4"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-base font-medium text-slate-200 mb-1">
            拖拽 MP4 文件到此处
          </p>
          <p className="text-sm text-slate-400">
            或点击选择文件（支持多选）
          </p>
          <p className="text-xs text-slate-500 mt-2">
            仅支持 MP4 格式，单个文件最大 500MB
          </p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              已选择 {selectedFiles.length} 个文件
            </span>
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                清空全部
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3 border border-slate-600/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <FileVideo className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-200 text-sm truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                {!disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              className="w-full py-2 px-4 border-2 border-dashed border-slate-600 rounded-lg
                text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400
                hover:bg-slate-700/30 transition-all duration-200
                flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加更多文件
            </button>
          )}
        </div>
      )}
    </div>
  );
};
