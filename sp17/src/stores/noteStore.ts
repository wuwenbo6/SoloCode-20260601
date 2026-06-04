import { create } from 'zustand'
import { encrypt, decrypt, computeBlindIndex, computeQueryHash } from '@/utils/crypto'
import * as api from '@/utils/api'
import { useAuthStore } from '@/stores/authStore'

export interface DecryptedNote {
  id: string
  title: string
  content: string
  tags: string[]
  attachments: api.AttachmentMeta[]
  createdAt: string
  updatedAt: string
  currentVersion: number
}

interface NoteState {
  notes: DecryptedNote[]
  currentNote: DecryptedNote | null
  searchQuery: string
  selectedTag: string | null
  allTags: string[]
  loading: boolean
  error: string | null
  fetchNotes: () => Promise<void>
  fetchNote: (id: string) => Promise<void>
  saveNote: (note: Partial<DecryptedNote> & { id?: string }) => Promise<string>
  deleteNote: (id: string) => Promise<void>
  search: (query: string) => Promise<void>
  filterByTag: (tag: string | null) => void
}

function getCryptoKey(): CryptoKey {
  const key = useAuthStore.getState().cryptoKey
  if (!key) throw new Error('Crypto key not available')
  return key
}

function getHmacKey(): CryptoKey {
  const key = useAuthStore.getState().hmacKey
  if (!key) throw new Error('HMAC key not available')
  return key
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  currentNote: null,
  searchQuery: '',
  selectedTag: null,
  allTags: [],
  loading: false,
  error: null,

  fetchNotes: async () => {
    set({ loading: true, error: null })
    try {
      const key = getCryptoKey()
      const res = await api.listNotes()
      const decrypted: DecryptedNote[] = []
      const tagSet = new Set<string>()
      for (const note of res.notes) {
        let title = ''
        let tags: string[] = []
        try {
          title = await decrypt(note.titleCiphertext, note.titleIv, key)
          const tagsRaw = await decrypt(note.tagsCiphertext, note.tagsIv, key)
          tags = JSON.parse(tagsRaw)
        } catch {
          title = '(decryption failed)'
          tags = []
        }
        tags.forEach((t) => tagSet.add(t))
        decrypted.push({
          id: note.id,
          title,
          content: '',
          tags,
          attachments: note.attachments || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          currentVersion: (note as any).currentVersion || 1,
        })
      }
      set({
        notes: decrypted,
        allTags: Array.from(tagSet).sort(),
        loading: false,
      })
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  fetchNote: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const key = getCryptoKey()
      const note = await api.getNote(id)
      let title = ''
      let content = ''
      let tags: string[] = []
      try {
        title = await decrypt(note.titleCiphertext, note.titleIv, key)
        if (note.contentCiphertext && note.contentIv) {
          content = await decrypt(note.contentCiphertext, note.contentIv, key)
        }
        const tagsRaw = await decrypt(note.tagsCiphertext, note.tagsIv, key)
        tags = JSON.parse(tagsRaw)
      } catch {
        title = title || '(decryption failed)'
      }
      set({
        currentNote: {
          id: note.id,
          title,
          content,
          tags,
          attachments: note.attachments || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          currentVersion: (note as any).currentVersion || 1,
        },
        loading: false,
      })
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  saveNote: async (note) => {
    set({ loading: true, error: null })
    try {
      const key = getCryptoKey()
      const hmacKey = getHmacKey()
      const title = note.title || 'Untitled'
      const content = note.content || ''
      const tags = note.tags || []
      const searchText = `${title} ${content} ${tags.join(' ')}`
      const searchIndex = await computeBlindIndex(searchText, hmacKey)
      const titleEnc = await encrypt(title, key)
      const contentEnc = await encrypt(content, key)
      const tagsEnc = await encrypt(JSON.stringify(tags), key)
      const payload = {
        titleCiphertext: titleEnc.ciphertext,
        titleIv: titleEnc.iv,
        contentCiphertext: contentEnc.ciphertext,
        contentIv: contentEnc.iv,
        tagsCiphertext: tagsEnc.ciphertext,
        tagsIv: tagsEnc.iv,
        searchIndex,
      }
      let noteId = note.id
      if (noteId) {
        await api.updateNote(noteId, payload)
      } else {
        const created = await api.createNote(payload)
        noteId = created.id
      }
      await get().fetchNotes()
      set({ loading: false })
      return noteId!
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message })
      throw err
    }
  },

  deleteNote: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await api.deleteNote(id)
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        currentNote: state.currentNote?.id === id ? null : state.currentNote,
        loading: false,
      }))
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query })
    if (!query.trim()) {
      await get().fetchNotes()
      return
    }
    set({ loading: true, error: null })
    try {
      const hmacKey = getHmacKey()
      const key = getCryptoKey()
      const queryHash = await computeQueryHash(query, hmacKey)
      const result = await api.searchNotes(queryHash)
      const decrypted: DecryptedNote[] = []
      for (const note of result.notes) {
        let title = ''
        try {
          title = await decrypt(note.titleCiphertext, note.titleIv, key)
        } catch {
          title = '(decryption failed)'
        }
        decrypted.push({
          id: note.id,
          title,
          content: '',
          tags: [],
          attachments: [],
          createdAt: note.updatedAt,
          updatedAt: note.updatedAt,
          currentVersion: 1,
        })
      }
      set({ notes: decrypted, loading: false })
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message, notes: [] })
    }
  },

  filterByTag: (tag: string | null) => {
    set({ selectedTag: tag })
  },
}))
