import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Share2, Tag, X, Loader2, Download, History } from 'lucide-react'
import { useNoteStore } from '@/stores/noteStore'
import MarkdownPreview from '@/components/MarkdownPreview'
import ShareDialog from '@/components/ShareDialog'
import ExportDialog from '@/components/ExportDialog'
import AttachmentManager from '@/components/AttachmentManager'
import VersionHistory from '@/components/VersionHistory'

export default function NoteEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    currentNote,
    loading,
    fetchNote,
    saveNote,
  } = useNoteStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'attachments'>('edit')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isNew = id === 'new'

  useEffect(() => {
    if (!isNew && id) {
      fetchNote(id)
    }
  }, [id, isNew, fetchNote])

  useEffect(() => {
    if (currentNote && !isNew) {
      setTitle(currentNote.title)
      setContent(currentNote.content)
      setTags(currentNote.tags)
    }
  }, [currentNote, isNew])

  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!title && !content) return
      setSaving(true)
      try {
        const noteId = await saveNote({
          id: isNew ? undefined : id,
          title,
          content,
          tags,
        })
        if (isNew && noteId) {
          navigate(`/notes/${noteId}`, { replace: true })
        }
      } catch {
        // auto-save silently fails
      } finally {
        setSaving(false)
      }
    }, 2000)
  }, [title, content, tags, id, isNew, saveNote, navigate])

  const handleContentChange = (value: string) => {
    setContent(value)
    triggerAutoSave()
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    triggerAutoSave()
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()])
        triggerAutoSave()
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
    triggerAutoSave()
  }

  const handleManualSave = async () => {
    setSaving(true)
    try {
      const noteId = await saveNote({
        id: isNew ? undefined : id,
        title,
        content,
        tags,
      })
      if (isNew && noteId) {
        navigate(`/notes/${noteId}`, { replace: true })
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-crypt-bg flex flex-col">
      <header className="bg-crypt-card border-b border-crypt-border px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate('/notes')}
          className="text-crypt-text hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title..."
          className="flex-1 bg-transparent text-white font-mono text-lg font-semibold placeholder:text-crypt-text/40 focus:outline-none min-w-0"
        />

        <div className="flex items-center gap-2 shrink-0">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-crypt-accent">
              <Loader2 size={12} className="animate-spin" />
              Saving
            </span>
          )}
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-crypt-accent text-crypt-bg px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-crypt-accent/90 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            Save
          </button>
          {!isNew && (
            <>
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 bg-crypt-bg border border-crypt-border text-crypt-text px-3 py-1.5 rounded-lg text-sm hover:text-white hover:border-crypt-accent/50 transition-colors"
              >
                <History size={14} />
                History
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center gap-1.5 bg-crypt-bg border border-crypt-border text-crypt-text px-3 py-1.5 rounded-lg text-sm hover:text-white hover:border-crypt-accent/50 transition-colors"
              >
                <Download size={14} />
                Export
              </button>
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center gap-1.5 bg-crypt-bg border border-crypt-border text-crypt-text px-3 py-1.5 rounded-lg text-sm hover:text-white hover:border-crypt-accent/50 transition-colors"
              >
                <Share2 size={14} />
                Share
              </button>
            </>
          )}
        </div>
      </header>

      <div className="px-4 py-2 border-b border-crypt-border flex items-center gap-2 flex-wrap">
        <Tag size={14} className="text-crypt-text/60 shrink-0" />
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-crypt-accent/20 text-crypt-accent text-xs px-2 py-0.5 rounded-md"
          >
            {tag}
            <button onClick={() => handleRemoveTag(tag)} className="hover:text-white transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          placeholder="Add tag..."
          className="bg-transparent text-white text-xs placeholder:text-crypt-text/40 focus:outline-none min-w-[80px]"
        />
      </div>

      <div className="flex border-b border-crypt-border">
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'edit' ? 'text-crypt-accent border-b-2 border-crypt-accent' : 'text-crypt-text hover:text-white'
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => setActiveTab('attachments')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'attachments' ? 'text-crypt-accent border-b-2 border-crypt-accent' : 'text-crypt-text hover:text-white'
          }`}
        >
          Attachments
        </button>
      </div>

      {activeTab === 'edit' ? (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 border-r border-crypt-border overflow-y-auto">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your note in Markdown..."
              className="w-full h-full bg-crypt-bg text-white p-6 font-mono text-sm leading-relaxed placeholder:text-crypt-text/40 focus:outline-none resize-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <MarkdownPreview content={content} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {!isNew && id ? (
            <AttachmentManager
              noteId={id}
              attachments={currentNote?.attachments || []}
              onAttachmentsChange={() => { if (id) fetchNote(id) }}
            />
          ) : (
            <p className="text-crypt-text text-sm text-center mt-12">Save the note first to manage attachments</p>
          )}
        </div>
      )}

      {showShare && currentNote && (
        <ShareDialog
          noteId={currentNote.id}
          title={title}
          content={content}
          onClose={() => setShowShare(false)}
        />
      )}

      {showExport && (
        <ExportDialog
          title={title}
          content={content}
          onClose={() => setShowExport(false)}
        />
      )}

      {showHistory && currentNote && (
        <VersionHistory
          noteId={currentNote.id}
          currentVersion={currentNote.currentVersion}
          onClose={() => setShowHistory(false)}
          onRestore={() => {
            if (id) fetchNote(id)
          }}
        />
      )}
    </div>
  )
}
