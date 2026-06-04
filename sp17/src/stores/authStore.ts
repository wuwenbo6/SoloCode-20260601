import { create } from 'zustand'
import { deriveKey, hashPassword, generateSalt, arrayBufferToBase64, base64ToArrayBuffer, deriveHmacKey } from '@/utils/crypto'
import * as api from '@/utils/api'

interface AuthState {
  user: { id: string; email: string; totpEnabled?: boolean } | null
  token: string | null
  cryptoKey: CryptoKey | null
  hmacKey: CryptoKey | null
  salt: Uint8Array | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<{ requiresTwoFactor: boolean; tempToken?: string } | void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  unlock: (password: string) => Promise<void>
  initFromStorage: () => void
  setAuth: (token: string, user: { id: string; email: string }, salt: Uint8Array) => void
  setTotpEnabled: (enabled: boolean) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  cryptoKey: null,
  hmacKey: null,
  salt: null,
  loading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const passwordHash = await hashPassword(password)
      const res = await api.login(email, passwordHash)
      if ('requiresTwoFactor' in res) {
        set({ loading: false })
        return { requiresTwoFactor: true, tempToken: res.tempToken }
      }
      const salt = new Uint8Array(base64ToArrayBuffer(res.user.salt))
      const cryptoKey = await deriveKey(password, salt)
      const hmacKey = await deriveHmacKey(cryptoKey)
      localStorage.setItem('token', res.token)
      set({
        user: res.user,
        token: res.token,
        cryptoKey,
        hmacKey,
        salt,
        loading: false,
      })
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message })
      throw err
    }
  },

  register: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const salt = generateSalt()
      const passwordHash = await hashPassword(password)
      const saltBase64 = arrayBufferToBase64(salt.buffer as ArrayBuffer)
      const res = await api.register(email, passwordHash, saltBase64)
      const cryptoKey = await deriveKey(password, salt)
      const hmacKey = await deriveHmacKey(cryptoKey)
      localStorage.setItem('token', res.token)
      set({
        user: res.user,
        token: res.token,
        cryptoKey,
        hmacKey,
        salt,
        loading: false,
      })
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({
      user: null,
      token: null,
      cryptoKey: null,
      hmacKey: null,
      salt: null,
    })
  },

  unlock: async (password: string) => {
    const { salt } = get()
    if (!salt) throw new Error('No salt available')
    set({ loading: true, error: null })
    try {
      const cryptoKey = await deriveKey(password, salt)
      const hmacKey = await deriveHmacKey(cryptoKey)
      set({ cryptoKey, hmacKey, loading: false })
    } catch (err: unknown) {
      set({ loading: false, error: (err as Error).message })
      throw err
    }
  },

  initFromStorage: async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    set({ token })
    try {
      const user = await api.getMe()
      const salt = new Uint8Array(base64ToArrayBuffer(user.salt))
      set({ user: { id: user.id, email: user.email, totpEnabled: user.totpEnabled }, salt })
    } catch {
      localStorage.removeItem('token')
      set({ token: null, user: null, salt: null })
    }
  },

  setAuth: (token: string, user: { id: string; email: string }, salt: Uint8Array) => {
    set({
      token,
      user,
      salt,
    })
  },

  setTotpEnabled: (enabled: boolean) => {
    set((state) => ({
      user: state.user ? { ...state.user, totpEnabled: enabled } : null,
    }))
  },
}))
