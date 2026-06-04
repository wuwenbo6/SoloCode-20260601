import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Shield, LogOut, Tag, FileText } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNoteStore } from '@/stores/noteStore'
import NoteCard from '@/components/NoteCard'

export default function Notes() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { notes, searchQuery, selectedTag, allTags, loading, fetchNotes, search, filterByTag } = useNoteStore()

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleSearch = useCallback((query: string) => {
    search(query)
  }, [search])

  const filteredNotes = notes.filter((note) => {
    const matchesTag = !selectedTag || note.tags.includes(selectedTag)
    return matchesTag
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNewNote = () => {
    navigate('/notes/new')
  }

  return (
    <div className="min-h-screen bg-crypt-bg flex">
      <aside className="w-64 bg-crypt-card border-r border-crypt-border flex flex-col shrink-0">
        <div className="p-5 border-b border-crypt-border">
          <div className="flex items-center gap-2.5">
            <Shield size={24} className="text-crypt-accent" />
            <h1 className="font-mono text-xl font-bold text-white">CryptNote</h1>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={handleNewNote}
            className="w-full flex items-center justify-center gap-2 bg-crypt-accent text-crypt-bg font-semibold rounded-lg py-2.5 text-sm hover:bg-crypt-accent/90 transition-colors"
          >
            <Plus size={16} />
            New Note
          </button>
        </div>

        <div className="flex-1 px-4 overflow-y-auto">
          <div className="flex items-center gap-2 text-xs text-crypt-text/60 uppercase tracking-wider mb-3">
            <Tag size={12} />
            Tags
          </div>
          <div className="space-y-1">
            <button
              onClick={() => filterByTag(null)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                !selectedTag ? 'bg-crypt-accent/20 text-crypt-accent' : 'text-crypt-text hover:text-white hover:bg-crypt-bg'
              }`}
            >
              All Notes
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => filterByTag(tag)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                  selectedTag === tag ? 'bg-crypt-accent/20 text-crypt-accent' : 'text-crypt-text hover:text-white hover:bg-crypt-bg'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-crypt-border">
          <div className="flex items-center gap-2 mb-3 text-xs text-crypt-text/60">
            <FileText size={12} />
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-crypt-text hover:text-red-400 transition-colors text-sm py-1.5"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="p-6 border-b border-crypt-border">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-crypt-text/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-crypt-card border border-crypt-border rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {loading && notes.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-crypt-text">
              Loading notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-crypt-text">
              <FileText size={48} className="mb-4 opacity-30" />
              <p className="text-lg">No notes found</p>
              <p className="text-sm mt-1 opacity-60">Create a new note to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
