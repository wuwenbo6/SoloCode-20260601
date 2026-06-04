import React, { useRef, useState } from 'react';
import { X, Upload, Image as ImageIcon, Video, Droplets, Palette, Eye, Trash2, Download, Sparkles } from 'lucide-react';
import { useAppStore, PRESET_BACKGROUNDS } from '@/store/useAppStore';
import { Background, VIRTUAL_BACKGROUNDS } from '@/types';
import { loadImageElement, loadVideoElement } from '@/utils/canvasUtils';

interface BackgroundSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    selectedBackground,
    setSelectedBackground,
    customBackgrounds,
    addCustomBackground,
    removeCustomBackground,
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        try {
          const imgElement = await loadImageElement(url);
          const background: Background = {
            id: `custom-image-${Date.now()}-${i}`,
            type: 'image',
            source: imgElement,
            name: file.name,
            thumbnail: url,
          };
          addCustomBackground(background);
        } catch (error) {
          console.error('Failed to load image:', error);
          URL.revokeObjectURL(url);
        }
      } else if (isVideo) {
        try {
          const videoElement = await loadVideoElement(url);
          const background: Background = {
            id: `custom-video-${Date.now()}-${i}`,
            type: 'video',
            source: videoElement,
            name: file.name,
            thumbnail: url,
          };
          addCustomBackground(background);
        } catch (error) {
          console.error('Failed to load video:', error);
          URL.revokeObjectURL(url);
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePresetSelect = (preset: typeof PRESET_BACKGROUNDS[0], index: number) => {
    const background: Background = {
      id: `preset-${preset.type}-${index}`,
      type: preset.type,
      source: preset.thumbnail || '',
      name: preset.name,
      thumbnail: preset.thumbnail,
      blurAmount: preset.blurAmount,
      color: preset.color,
      bokehLevel: preset.bokehLevel,
    };
    setSelectedBackground(background);
  };

  const handleVirtualSelect = async (preset: typeof VIRTUAL_BACKGROUNDS[0]) => {
    try {
      const imgElement = await loadImageElement(preset.thumbnail || preset.downloadUrl || '');
      const background: Background = {
        id: `virtual-${preset.source}-${Date.now()}`,
        type: 'image',
        source: imgElement,
        name: preset.name,
        thumbnail: preset.thumbnail,
        downloadUrl: preset.downloadUrl,
        downloadable: preset.downloadable,
      };
      setSelectedBackground(background);
    } catch (error) {
      console.error('Failed to load virtual background:', error);
    }
  };

  const handleDownloadBackground = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${name || 'background'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download background:', error);
      window.open(url, '_blank');
    }
  };

  const handleCustomSelect = (background: Background) => {
    setSelectedBackground(background);
  };

  const renderThumbnail = (background: Background | typeof PRESET_BACKGROUNDS[0] | typeof VIRTUAL_BACKGROUNDS[0], isSelected: boolean) => {
    if (background.type === 'color' && background.color) {
      return (
        <div
          className="w-full h-full rounded-lg"
          style={{ backgroundColor: background.color }}
        />
      );
    }

    if (background.type === 'bokeh') {
      return (
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3)_0%,transparent_50%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.2)_0%,transparent_40%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.15)_0%,transparent_30%)]" />
          <Sparkles className="w-6 h-6 text-white/70 relative z-10" />
        </div>
      );
    }

    if (background.type === 'blur') {
      return (
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
          <Droplets className="w-6 h-6 text-slate-400" />
        </div>
      );
    }

    if (background.type === 'transparent') {
      return (
        <div className="w-full h-full rounded-lg bg-[repeating-conic-gradient(#334155_0_25%,_#1e293b_0_50%)] bg-[length:16px_16px] flex items-center justify-center">
          <Eye className="w-6 h-6 text-slate-400" />
        </div>
      );
    }

    if (background.thumbnail) {
      return (
        <img
          src={background.thumbnail}
          alt={background.name || 'background'}
          className="w-full h-full object-cover rounded-lg"
        />
      );
    }

    if (background.type === 'video') {
      return (
        <div className="w-full h-full rounded-lg bg-slate-700 flex items-center justify-center">
          <Video className="w-6 h-6 text-slate-400" />
        </div>
      );
    }

    return (
      <div className="w-full h-full rounded-lg bg-slate-700 flex items-center justify-center">
        <ImageIcon className="w-6 h-6 text-slate-400" />
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-8 bottom-0 w-80 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 z-30 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <h3 className="text-lg font-semibold text-white">选择背景</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-200 mb-6 ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
          }`}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-300 font-medium">
            拖放图片或视频到这里
          </p>
          <p className="text-xs text-slate-500 mt-1">或点击选择文件</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            预设背景
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {PRESET_BACKGROUNDS.map((preset, index) => {
              const isSelected =
                selectedBackground?.id === `preset-${preset.type}-${index}`;
              return (
                <button
                  key={`preset-${preset.type}-${index}`}
                  onClick={() => handlePresetSelect(preset, index)}
                  className={`relative aspect-square rounded-xl overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 scale-105'
                      : 'hover:scale-105'
                  }`}
                >
                  {renderThumbnail(preset, isSelected)}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <p className="text-[10px] text-white truncate">
                      {preset.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            虚拟背景
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {VIRTUAL_BACKGROUNDS.map((preset, index) => {
              const isSelected =
                selectedBackground?.id === `virtual-${preset.source}-${index}`;
              return (
                <div
                  key={`virtual-${preset.source}-${index}`}
                  className={`relative aspect-video rounded-xl overflow-hidden transition-all duration-200 group ${
                    isSelected
                      ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900'
                      : 'hover:ring-2 hover:ring-slate-600'
                  }`}
                >
                  <button
                    onClick={() => handleVirtualSelect(preset)}
                    className="w-full h-full"
                  >
                    {renderThumbnail(preset, isSelected)}
                  </button>
                  {preset.downloadable && preset.downloadUrl && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadBackground(preset.downloadUrl!, preset.name || 'background');
                        }}
                        className="p-1 bg-cyan-500/90 rounded-lg text-white hover:bg-cyan-600 transition-colors"
                        title="下载高清原图"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white truncate">
                      {preset.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {customBackgrounds.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              自定义背景
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {customBackgrounds.map((background) => {
                const isSelected =
                  selectedBackground?.id === background.id;
                return (
                  <div
                    key={background.id}
                    className={`relative aspect-video rounded-xl overflow-hidden transition-all duration-200 group ${
                      isSelected
                        ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900'
                        : 'hover:ring-2 hover:ring-slate-600'
                    }`}
                  >
                    <button
                      onClick={() => handleCustomSelect(background)}
                      className="w-full h-full"
                    >
                      {renderThumbnail(background, isSelected)}
                    </button>
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomBackground(background.id);
                        }}
                        className="p-1 bg-red-500/90 rounded-lg text-white hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white truncate">
                        {background.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
