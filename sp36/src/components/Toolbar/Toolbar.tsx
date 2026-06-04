import { useRef } from 'react'
import { FilePlus, FolderOpen, Download, Music, Save, ZoomIn, ZoomOut } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'

export function Toolbar() {
  const {
    project,
    addTrack,
    saveProject,
    exportWAV,
    newProject,
    updateProject,
    isLoading,
    zoom,
    setZoom,
  } = useAudioStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      for (let i = 0; i < files.length; i++) {
        await addTrack(files[i])
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleProjectLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const content = await file.text()
      useAudioStore.getState().loadProject(content)
    }
    if (projectInputRef.current) {
      projectInputRef.current.value = ''
    }
  }

  const handleExportWAV = async () => {
    try {
      const blob = await exportWAV()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name}.wav`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="h-14 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700 flex items-center px-4 gap-2">
      <div className="flex items-center gap-1 pr-4 border-r border-gray-700">
        <button
          onClick={() => newProject()}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
          title="新建项目"
        >
          <FilePlus size={18} className="text-gray-400 group-hover:text-white" />
        </button>
        <button
          onClick={() => projectInputRef.current?.click()}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
          title="加载项目"
        >
          <FolderOpen size={18} className="text-gray-400 group-hover:text-white" />
        </button>
        <button
          onClick={() => saveProject()}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
          title="保存项目 (XML)"
        >
          <Save size={18} className="text-gray-400 group-hover:text-white" />
        </button>
        <input
          ref={projectInputRef}
          type="file"
          accept=".xml"
          onChange={handleProjectLoad}
          className="hidden"
        />
      </div>

      <div className="flex items-center gap-1 px-4 border-r border-gray-700">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 rounded-lg transition-colors text-white text-sm font-medium"
        >
          <Music size={16} />
          {isLoading ? '导入中...' : '导入音频'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="flex items-center gap-1 px-4 border-r border-gray-700">
        <button
          onClick={() => setZoom(Math.max(0.5, zoom * 0.8))}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
          title="缩小"
        >
          <ZoomOut size={18} className="text-gray-400 group-hover:text-white" />
        </button>
        <span className="text-xs text-gray-400 w-12 text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(Math.min(8, zoom * 1.25))}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
          title="放大"
        >
          <ZoomIn size={18} className="text-gray-400 group-hover:text-white" />
        </button>
      </div>

      <div className="flex-1 px-4">
        <input
          type="text"
          value={project.name}
          onChange={(e) => updateProject({ name: e.target.value })}
          className="bg-transparent text-white text-lg font-medium outline-none border-b border-transparent hover:border-gray-600 focus:border-cyan-500 transition-colors px-1"
          placeholder="项目名称"
        />
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleExportWAV}
          className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg transition-colors text-white text-sm font-medium"
        >
          <Download size={16} />
          导出 WAV
        </button>
      </div>
    </div>
  )
}
