import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, Lock, Clock, AlertCircle } from 'lucide-react'
import { deriveKey, decrypt, base64ToArrayBuffer } from '@/utils/crypto'
import { getShare } from '@/utils/api'
import MarkdownPreview from '@/components/MarkdownPreview'

export default function ShareView() {
  const { shareId } = useParams()
  const [password, setPassword] = useState('')
  const [decrypted, setDecrypted] = useState<{ title: string; content: string } | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!expiresAt) return
    const timer = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('Expired')
        clearInterval(timer)
        return
      }
      const hours = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setCountdown(`${hours}h ${mins}m ${secs}s`)
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareId) return
    setLoading(true)
    setError('')
    try {
      const share = await getShare(shareId)
      if (share.isExpired) {
        setError('This share link has expired')
        return
      }
      const salt = new Uint8Array(base64ToArrayBuffer(share.salt))
      const key = await deriveKey(password, salt)
      const title = await decrypt(share.titleCiphertext, share.titleIv, key)
      const content = await decrypt(share.contentCiphertext, share.contentIv, key)
      setDecrypted({ title, content })
      setExpiresAt(share.expiresAt)
    } catch {
      setError('Invalid password or decryption failed')
    } finally {
      setLoading(false)
    }
  }

  if (decrypted) {
    return (
      <div className="min-h-screen bg-crypt-bg p-6 flex justify-center">
        <div className="w-full max-w-3xl animate-fadeIn">
          <div className="flex items-center gap-2 mb-6">
            <Shield size={20} className="text-crypt-accent" />
            <span className="font-mono text-crypt-accent text-sm">Shared Note</span>
            {countdown && (
              <span className="flex items-center gap-1 text-xs text-crypt-text ml-auto">
                <Clock size={12} />
                Expires in {countdown}
              </span>
            )}
          </div>
          <h1 className="font-mono text-3xl font-bold text-white mb-6">{decrypted.title}</h1>
          <div className="bg-crypt-card border border-crypt-border rounded-xl p-8">
            <MarkdownPreview content={decrypted.content} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-crypt-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-crypt-accent/20 rounded-2xl mb-4">
            <Shield size={32} className="text-crypt-accent" />
          </div>
          <h1 className="font-mono text-2xl font-bold text-white">Shared Note</h1>
          <p className="text-crypt-text mt-2 text-sm">Enter the access password to decrypt</p>
        </div>

        <div className="bg-crypt-card border border-crypt-border rounded-xl p-8">
          <form onSubmit={handleDecrypt} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm text-crypt-text mb-1.5">
                <Lock size={14} />
                Access Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access password"
                required
                className="w-full bg-crypt-bg border border-crypt-border rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-crypt-accent text-crypt-bg font-semibold rounded-lg py-2.5 text-sm hover:bg-crypt-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Decrypting...' : 'Decrypt Note'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
