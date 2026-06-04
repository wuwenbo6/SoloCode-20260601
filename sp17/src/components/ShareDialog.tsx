import { useState } from 'react'
import { X, Copy, Link2, Clock, KeyRound } from 'lucide-react'
import { encrypt, deriveKey, generateSalt, arrayBufferToBase64 } from '@/utils/crypto'
import { createShare } from '@/utils/api'
import { useAuthStore } from '@/stores/authStore'

const EXPIRATION_OPTIONS = [
  { label: '1 Hour', value: 3600000 },
  { label: '24 Hours', value: 86400000 },
  { label: '7 Days', value: 604800000 },
  { label: '30 Days', value: 2592000000 },
]

interface ShareDialogProps {
  noteId: string
  title: string
  content: string
  onClose: () => void
}

export default function ShareDialog({ noteId, title, content, onClose }: ShareDialogProps) {
  const [expiration, setExpiration] = useState(EXPIRATION_OPTIONS[1].value)
  const [accessPassword, setAccessPassword] = useState('')
  const [shareLink, setShareLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!accessPassword) {
      setError('Please enter an access password')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const salt = generateSalt()
      const shareKey = await deriveKey(accessPassword, salt)
      const titleEnc = await encrypt(title, shareKey)
      const contentEnc = await encrypt(content, shareKey)
      const expiresAt = new Date(Date.now() + expiration).toISOString()
      const res = await createShare({
        noteId,
        contentCiphertext: contentEnc.ciphertext,
        contentIv: contentEnc.iv,
        titleCiphertext: titleEnc.ciphertext,
        titleIv: titleEnc.iv,
        salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
        expiresAt,
      })
      const base = window.location.origin
      setShareLink(`${base}/share/${res.shareId}`)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-crypt-card border border-crypt-border rounded-xl w-full max-w-md p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-white text-xl font-bold">Share Note</h2>
          <button onClick={onClose} className="text-crypt-text hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-crypt-text mb-2">
              <Clock size={14} />
              Expiration
            </label>
            <select
              value={expiration}
              onChange={(e) => setExpiration(Number(e.target.value))}
              className="w-full bg-crypt-bg border border-crypt-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-crypt-accent"
            >
              {EXPIRATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-crypt-text mb-2">
              <KeyRound size={14} />
              Access Password
            </label>
            <input
              type="password"
              value={accessPassword}
              onChange={(e) => setAccessPassword(e.target.value)}
              placeholder="Enter password for recipients"
              className="w-full bg-crypt-bg border border-crypt-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {shareLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-crypt-bg border border-crypt-border rounded-lg px-3 py-2">
                <Link2 size={14} className="text-crypt-accent shrink-0" />
                <span className="text-white text-xs truncate flex-1">{shareLink}</span>
              </div>
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 bg-crypt-accent/20 text-crypt-accent rounded-lg px-4 py-2 text-sm hover:bg-crypt-accent/30 transition-colors"
              >
                <Copy size={14} />
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-crypt-accent text-crypt-bg font-semibold rounded-lg px-4 py-2 text-sm hover:bg-crypt-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Share Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
