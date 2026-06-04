import { useState, useEffect } from 'react'
import { X, Clock, RotateCcw, Eye, Loader2 } from 'lucide-react'
import { getNoteVersions, getNoteVersion, restoreNoteVersion, type NoteVersionMeta } from '@/utils/api'
import { useAuthStore } from '@/stores/authStore'
import { decrypt } from '@/utils/crypto'

interface VersionHistoryProps {
  noteId: string
  currentVersion: number
  onClose: () => void
  onRestore: () => void
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function VersionHistory({ noteId, currentVersion, onClose, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<NoteVersionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<{ title: string; content: string; tags: string[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState<number | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cryptoKey = useAuthStore((s) => s.cryptoKey)

  useEffect(() => {
    loadVersions()
  }, [noteId])

  const loadVersions = async () => {
    try {
      setLoading(true)
      const res = await getNoteVersions(noteId)
      setVersions(res.versions)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async (version: number) => {
    if (previewVersion === version) {
      setPreviewVersion(null)
      setPreviewData(null)
      return
    }

    try {
      setPreviewLoading(true)
      setPreviewVersion(version)
      const versionData = await getNoteVersion(noteId, version)

      if (cryptoKey) {
        const title = await decrypt(versionData.titleCiphertext, versionData.titleIv, cryptoKey)
        const content = await decrypt(versionData.contentCiphertext, versionData.contentIv, cryptoKey)
        const tagsStr = await decrypt(versionData.tagsCiphertext, versionData.tagsIv, cryptoKey)
        const tags = JSON.parse(tagsStr || '[]')

        setPreviewData({ title, content, tags })
      }
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleRestore = async (version: number) => {
    if (restoreConfirm !== version) {
      setRestoreConfirm(version)
      return
    }

    try {
      setRestoring(true)
      await restoreNoteVersion(noteId, version)
      onRestore()
      onClose()
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-crypt-card border border-crypt-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-fadeIn">
        <div className="flex items-center justify-between p-4 border-b border-crypt-border">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-crypt-accent" />
            <h2 className="font-mono text-white text-xl font-bold">Version History</h2>
          </div>
          <button onClick={onClose} className="text-crypt-text hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-crypt-accent" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-crypt-text text-sm text-center py-8">No versions found</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.version} className="bg-crypt-bg border border-crypt-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-crypt-accent/20 flex items-center justify-center">
                        <span className="text-crypt-accent text-xs font-bold">#{v.version}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">Version {v.version}</span>
                          {v.version === currentVersion && (
                            <span className="bg-crypt-accent/20 text-crypt-accent text-xs px-2 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <span className="text-crypt-text text-xs">{formatRelativeTime(v.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreview(v.version)}
                        className="flex items-center gap-1 text-crypt-text hover:text-white text-xs px-2 py-1 rounded hover:bg-crypt-accent/10 transition-colors"
                      >
                        <Eye size={14} />
                        {previewVersion === v.version ? 'Hide' : 'Preview'}
                      </button>
                      {v.version !== currentVersion && (
                        <button
                          onClick={() => handleRestore(v.version)}
                          disabled={restoring && restoreConfirm === v.version}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                            restoreConfirm === v.version
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : 'text-crypt-text hover:text-crypt-accent hover:bg-crypt-accent/10'
                          } disabled:opacity-50`}
                        >
                          {restoring && restoreConfirm === v.version ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                          {restoreConfirm === v.version ? 'Confirm?' : 'Restore'}
                        </button>
                      )}
                    </div>
                  </div>

                  {previewVersion === v.version && (
                    <div className="border-t border-crypt-border p-4">
                      {previewLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 size={20} className="animate-spin text-crypt-accent" />
                        </div>
                      ) : previewData ? (
                        <div className="space-y-3">
                          <div>
                            <span className="text-crypt-text text-xs uppercase tracking-wide">Title</span>
                            <p className="text-white text-sm mt-1">{previewData.title || '(Untitled)'}</p>
                          </div>
                          <div>
                            <span className="text-crypt-text text-xs uppercase tracking-wide">Tags</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {previewData.tags.length > 0 ? (
                                previewData.tags.map((tag) => (
                                  <span key={tag} className="bg-crypt-accent/20 text-crypt-accent text-xs px-2 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-crypt-text text-sm">(No tags)</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-crypt-text text-xs uppercase tracking-wide">Content Preview</span>
                            <p className="text-crypt-text text-sm mt-1 line-clamp-3 font-mono">
                              {previewData.content || '(Empty)'}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
