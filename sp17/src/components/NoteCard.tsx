import { useNavigate } from 'react-router-dom'
import { Clock, Tag } from 'lucide-react'
import type { DecryptedNote } from '@/stores/noteStore'

const TAG_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-cyan-500',
]

function getTagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function NoteCard({ note }: { note: DecryptedNote }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/notes/${note.id}`)}
      className="bg-crypt-card border border-crypt-border rounded-lg p-5 cursor-pointer
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-crypt-accent/10 hover:border-crypt-accent/30"
    >
      <h3 className="font-mono text-white text-lg font-semibold mb-3 truncate">
        {note.title || 'Untitled'}
      </h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {note.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs text-crypt-text"
          >
            <span className={`w-2 h-2 rounded-full ${getTagColor(tag)}`} />
            {tag}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-crypt-text/60">
        <Clock size={12} />
        {formatRelativeDate(note.updatedAt)}
      </div>
    </div>
  )
}
