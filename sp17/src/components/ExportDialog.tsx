import { useState } from 'react'
import { X, Download, FileText, FileType } from 'lucide-react'
import { exportPdf, exportDocx } from '@/utils/api'

interface ExportDialogProps {
  title: string
  content: string
  onClose: () => void
}

type ExportFormat = 'pdf' | 'docx'

export default function ExportDialog({ title, content, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [includeTitle, setIncludeTitle] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      const exportTitle = includeTitle ? title : ''
      const blob = format === 'pdf'
        ? await exportPdf(content, exportTitle)
        : await exportDocx(content, exportTitle)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title || 'document'}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onClose()
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-crypt-card border border-crypt-border rounded-xl w-full max-w-md p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-white text-xl font-bold">Export Note</h2>
          <button onClick={onClose} className="text-crypt-text hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm text-crypt-text mb-3">
              <FileType size={14} />
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  format === 'pdf'
                    ? 'border-crypt-accent bg-crypt-accent/10 text-crypt-accent'
                    : 'border-crypt-border text-crypt-text hover:border-crypt-accent/50'
                }`}
              >
                <FileText size={24} />
                <span className="text-sm font-medium">PDF</span>
              </button>
              <button
                onClick={() => setFormat('docx')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  format === 'docx'
                    ? 'border-crypt-accent bg-crypt-accent/10 text-crypt-accent'
                    : 'border-crypt-border text-crypt-text hover:border-crypt-accent/50'
                }`}
              >
                <FileText size={24} />
                <span className="text-sm font-medium">DOCX</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="includeTitle"
              checked={includeTitle}
              onChange={(e) => setIncludeTitle(e.target.checked)}
              className="w-4 h-4 rounded border-crypt-border bg-crypt-bg text-crypt-accent focus:ring-crypt-accent focus:ring-offset-0"
            />
            <label htmlFor="includeTitle" className="text-sm text-crypt-text">
              Include title in export
            </label>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-crypt-accent text-crypt-bg font-semibold rounded-lg px-4 py-3 text-sm hover:bg-crypt-accent/90 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {loading ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
